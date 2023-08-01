import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { ReceiptsService } from "./receipts.service";
import { AppUtils, Receipt } from "../lib";
import { Converter } from "../converter";
import { isAfter, isEqual } from "date-fns";

@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.receipt;
        if (!obj) {
          return reject("Please set receipt and try again !");
        }
        const toSave = new Receipt().toObject(obj);
        const fee = await this.service.getFeeById(toSave.fee_id);
        if (!fee) {
          return reject("fees structure used doesn't exist or was removed");
        }
        const student = await this.service.getStudentById(toSave.student_id);
        if (!student) {
          return reject("student doesn't exist or was removed");
        }
        const period = await this.service.getPeriodById(toSave.period_id);
        if (!period) {
          return reject("period specified doesn't exist or was removed");
        }
        const level = await this.service.getLevelById(toSave.level_id);
        if (!level) {
          return reject("class/level specified doesn't exist or was removed");
        }
        await toSave.validate(fee.value);
        if (!toSave.isNew()) {
          // check it against the old receipt
          const oldReceipt = await this.service.getReceiptById(toSave.id);
          if (!oldReceipt) {
            return reject("receipt doesn't exist or was removed");
          }
          const studentChanged = oldReceipt.student_id !== toSave.student_id;
          if (studentChanged) {
            return reject("student can't be changed on this receipt");
          }
        }
        // ensure date of payment lies within current period
        // removed this line since we might need to pay last term's debts
        // period.validateStatus(toSave.getDate())
        const promises: Promise<any>[] = [];
        let firstTransaction = toSave.getTransaction();
        const firstBalance = AppUtils.minus(toSave.total, toSave.amount);
        if (!toSave.isNew()) {
          const oldTransactions = await this.service.getTransactionsByRefNo(toSave.id);
          if (oldTransactions.length === 0) {
            firstTransaction.referenceNo = toSave.id;
          } else {
            const firstTxIndex = oldTransactions.findIndex((tx: any) => tx.no === 1);
            if (firstTxIndex > -1) {
              firstTransaction = oldTransactions[firstTxIndex];
            }
            // find transactions whose date is now before modified date
            const invalidDateTransactions = oldTransactions.filter((tx) => {
              // skip first tx since it will be modified later anyway
              if (tx.no === 1) {
                return false;
              }
              const isValidDate = isEqual(tx.getDate(), toSave.getDate()) ||
                isAfter(tx.getDate(), toSave.getDate());
              return !isValidDate;
            });
            if (invalidDateTransactions.length > 0) {
              invalidDateTransactions.forEach((tx) => {
                const oldTxIndex = oldTransactions.findIndex((tr: any) => tr.id === tx.id);
                if (oldTxIndex > -1) {
                  tx.date = toSave.getDate();
                  oldTransactions[oldTxIndex].date = toSave.getDate();
                }
              });
            }
            const transactions = oldTransactions.filter((tx: any) => tx.no > 1);
            // adjust balances on these transactions
            const sortedList = transactions.sort((a, b) => AppUtils.sortComp(a.no.toLocaleString(), b.no.toLocaleString()));
            let breakPoint = 0;
            const newOldTx = [];
            for (const oldTransaction of sortedList) {
              if (oldTransaction.no === 2) {
                oldTransaction.balance = AppUtils.minus(firstBalance, oldTransaction.amount);
              } else {
                const previousTxNo = AppUtils.toNum(oldTransaction.no) - 1;
                const previousTx = sortedList.find((tx) => tx.no === previousTxNo);
                /* check for previousTx to avoid this error
                 Cannot read properties of undefined (reading 'balance')
                 */
                if (previousTx) {
                  oldTransaction.balance = AppUtils.minus(previousTx.balance, oldTransaction.amount);
                } else {
                  return reject(`transaction numbers are out of sync current No is ${oldTransaction.no} previous no ${previousTxNo} not found`);
                }
              }
              if (oldTransaction.balance < 0) {
                oldTransaction.amount = oldTransaction.balance;
                oldTransaction.balance = 0;
              }
              if (oldTransaction.balance <= 0) {
                // remove other transactions after this one since receipt is cleared fully
                breakPoint = oldTransaction.no;
                break;
              }
              newOldTx.push(oldTransaction);
              promises.push(this.service.saveTransaction(oldTransaction));
            }
            if (breakPoint > 0) {
              const toRemove = sortedList.filter((tx) => tx.no > breakPoint);
              if (toRemove.length > 0) {
                promises.push(this.service.deleteManyTransactions(toRemove.map((tx) => tx.id)));
              }
            }
            // compute balance using old transactions excluding the first one since it was modified
            const totalPaidSoFar = AppUtils.mapReduceToNum(newOldTx, "amount");
            const totalPaid = AppUtils.add(totalPaidSoFar, toSave.amount);
            if (totalPaid > toSave.total) {
              const totalPaidMsg = AppUtils.num2String(totalPaid, true);
              const requiredMsg = AppUtils.num2String(toSave.total, true);
              const exceedsMsg = `Total Amount Paid ${totalPaidMsg} exceeds total required ${requiredMsg}, first remove irrelevant transactions`;
              return reject(exceedsMsg);
            }
            toSave.balance = AppUtils.minus(toSave.total, totalPaid);
          }
        } else {
          // check for similar unpaid receipts and abort if any exist
          const unpaidOptions = {
            student_id: toSave.student_id
            // fee_id: toSave.fee_id,
            // period_id: toSave.period_id,
            // balance: 0, // this didn't work in production
            // balanceOperator: '>'
          };
          const similarReceipts = await this.service.getReceiptsByOptions(unpaidOptions);
          const unpaid = similarReceipts.find((receipt) => receipt.balance > 0);
          if (unpaid) {
            return reject(`first clear outstanding balance of ${unpaid.balance.toLocaleString()}`);
          }
        }
        const saved = await this.save(toSave);
        firstTransaction.no = 1;
        firstTransaction.amount = saved.amount;
        firstTransaction.mode = saved.mode;
        firstTransaction.date = saved.getDate();
        firstTransaction.balance = firstBalance;
        firstTransaction.referenceNo = saved.id;
        firstTransaction.receivedFrom = saved.receivedFrom;
        firstTransaction.for = saved.for;
        promises.push(this.service.saveTransaction(firstTransaction));
        await Promise.all(promises);
        return resolve(AppUtils.sanitizeObject(saved));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>((resolve, reject) => {
      return this.service.getReceiptsByOptions(options || {})
        .then((receipts) => {
          return resolve(receipts);
        }).catch((reason) => reject(reason));
    });
  }

  @Delete("delete")
  remove(@Query("receiptId") receiptId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(receiptId)) {
          return reject("select receipt and try again");
        }
        const transactions = await this.service.getTransactionsByRefNo(receiptId);
        if (transactions.length > 0) {
          return reject("Receipt has payments and cannot be removed");
        }
        const removed = await this.service.deleteManyReceipts([receiptId]);
        // removes old transactions here in old api, but it's useless based on first check
        return  resolve(removed);
      } catch (e) {
        return reject(e);
      }
    });
  }
}
