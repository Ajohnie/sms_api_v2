import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { TransactionsService } from "./transactions.service";
import { AppUtils, ExpenseType, Transaction } from "../lib";
import { Converter } from "../converter";
import { isAfter, isEqual } from "date-fns";

@Controller("transactions")
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.transaction;
        if (!obj) {
          return reject("Please set transaction and try again !");
        }
        const toSave = new Transaction().toObject(obj);
        const options = { referenceNo: toSave.referenceNo, type: toSave.type };
        const promises: Promise<any>[] = [];
        // check if referenceNo exists
        switch (toSave.type) {
          case ExpenseType.Receipt:
            const receipt = await this.service.getReceiptById(toSave.referenceNo);
            if (!receipt) {
              return reject(`Receipt for this transaction was removed`);
            }
            toSave.name = receipt.studentName;
            // check if receipt is fully cleared
            if (receipt.balance === 0) {
              return reject(`Receipt for ${toSave.name} is fully cleared`);
            }
            // make sure transaction date is after receipt date
            const isValidDate = isEqual(toSave.getDate(), receipt.getDate()) || isAfter(toSave.getDate(), receipt.getDate());
            if (!isValidDate) {
              return reject(`Transaction Date must be/after ${AppUtils.getSlashedDate(receipt.getDate())}`);
            }
            const total = receipt.total;
            // set transaction no
            const oldTransactions = await this.service.getTransactionsByOptions(options);
            if (oldTransactions.length === 0) {
              toSave.no = 1;
            } else {
              // check if transaction has id
              if (toSave.isNew()) {
                const sortedTx = oldTransactions.sort((a, b) => AppUtils.sortComp(a.getTimeString(), b.getTimeString()));
                const lastTx = sortedTx[sortedTx.length - 1];
                toSave.no = lastTx.no + 1;
              }
            }
            // set balance on receipt
            const totalPaidSoFar = AppUtils.mapReduceToNum(oldTransactions, "amount");
            const totalPaid = AppUtils.add(totalPaidSoFar, toSave.amount);
            if (totalPaid > total) {
              return reject(`Total Amount Paid ${AppUtils.num2String(totalPaid, true)} exceeds total required ${AppUtils.num2String(receipt.total, true)}`);
            }
            receipt.balance = AppUtils.minus(total, totalPaid);
            toSave.balance = receipt.balance;
            promises.push(this.service.saveReceipt(receipt));
            break;
          case ExpenseType.Purchase:
            break;
          case ExpenseType.Payment:
            break;
          case ExpenseType.Wage:
            break;
          case ExpenseType.Supplier:
            break;
          default:
            return reject(`Transaction type ${toSave.type} is unknown`);

        }
        const saved = await this.service.save(toSave);
        await Promise.all(promises);
        return resolve(AppUtils.sanitizeObject(saved));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        if (AppUtils.stringIsSet(options.expenseId)) {
          const receipts = await this.service.getReceiptsByOptions(options);
          const allTransactions: Transaction[] = [];
          for (const receipt of receipts) {
            options.referenceNo = receipt.id;
            options.type = ExpenseType.Receipt;
            const transactions: Transaction[] = await this.service.getTransactionsByOptions(options);
            allTransactions.push(...transactions);
          }
          return resolve(allTransactions);
        }
        const transactions = await this.service.getTransactionsByOptions(options || {});
        return resolve(transactions);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("transactionId") transactionId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(transactionId)) {
          return reject("select transaction and try again");
        }
        const transaction = await this.service.getTransactionById(transactionId);
        if (!transaction) {
          return reject("Transaction not found or was removed !");
        }
        if (transaction.type === ExpenseType.Receipt) {
          const receipt = await this.service.getReceiptById(transaction.referenceNo);
          if (!receipt) {
            return reject(`Receipt for this transaction was removed`);
          }
          const receiptIsPaid = receipt.isPaid();
          if (receiptIsPaid) {
            return reject(`receipt is fully paid and can not be removed`);
          }
        }
        const promises: Promise<any>[] = [];
        const options = { referenceNo: transaction.referenceNo, type: transaction.type };
        // check if referenceNo exists
        switch (transaction.type) {
          case ExpenseType.Receipt:
            const receipt = await this.service.getReceiptById(transaction.referenceNo);
            if (!receipt) {
              return reject(`Receipt for this transaction was removed`);
            }
            const total = receipt.total;
            // set transaction no
            const oldTransactions = await this.service.getTransactionsByOptions(options);
            const sortedTx = oldTransactions.sort((a, b) => AppUtils.sortComp(a.getTimeString(), b.getTimeString()));
            sortedTx.forEach((value, index) => {
              value.no = index + 1;
              promises.push(this.service.save(value));
            });
            // set balance on receipt
            const totalPaid = AppUtils.mapReduceToNum(oldTransactions, "amount");
            if (totalPaid > total) {
              receipt.balance = 0;
            } else {
              receipt.balance = AppUtils.minus(total, totalPaid);
            }
            promises.push(this.service.saveReceipt(receipt));
            break;
          case ExpenseType.Purchase:
            break;
          case ExpenseType.Wage:
            break;
          case ExpenseType.Supplier:
            break;
          case ExpenseType.Payment:
            break;
          default:
            return reject(`Transaction type ${transaction.type} is unknown`);

        }
        const removed = await this.service.deleteManyTransactions([transactionId]);
        await Promise.all(promises);
        return resolve(removed);
      } catch (e) {
        return reject(e);
      }
    });
  }
}
