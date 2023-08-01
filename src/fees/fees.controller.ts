import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { FeesService } from "./fees.service";
import { AppUtils, ExpenseType, Fee, Transaction } from "../lib";
import { Converter } from "../converter";

@Controller("fees")
export class FeesController {
  constructor(private readonly service: FeesService) {
  }

  @Post("clearDebt")
  clearDebt(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const params = Converter.fromBody(body);
        const feeId = params.feeId;
        if (!AppUtils.stringIsSet(feeId)) {
          return reject("Please select fee to clear and try again !");
        }
        const amount = AppUtils.toNum(params.amount);
        const receiptMethod = params.receiptMethod;
        const date = AppUtils.fireDate(params.date);
        if (!AppUtils.stringIsSet(receiptMethod)) {
          return reject("Please Select receipt method and Try Again");
        }
        if (!feeId) {
          return reject("Please Select fee and Try Again");
        }
        if (amount <= 0) {
          return reject("Please Enter Amount above zero and Try Again");
        }
        const fee = await this.service.getFeeById(feeId);
        if (!fee) {
          return reject("Unknown fee!");
        }
        if (amount <= 0) {
          return reject(`Amount must be above zero`);
        }
        const closingBalance = fee.getClosingBalance();
        if (amount > closingBalance) {
          return reject(`Maximum amount allowed for ${fee.name} is ${AppUtils.num2String(closingBalance, true)}`);
        }
        const transaction = new Transaction(feeId, fee.name, ExpenseType.Expense);
        transaction.amount = amount;
        transaction.mode = receiptMethod;
        transaction.date = date;
        await this.service.saveTransaction(transaction);
        return resolve(true);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.fee;
        if (!obj) {
          return reject("Please set fee and try again !");
        }
        const fee = new Fee().toObject(obj);
        return this.service.save(fee)
          .then((sup) => resolve(AppUtils.sanitizeObject(sup)))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        let fees = await this.service.getFeesByOptions(options || {});
        return resolve(fees);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("feeId") feeId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(feeId)) {
          return reject("select fee and try again");
        }
        const fee = await this.service.getFeeById(feeId);
        if (!fee) {
          return reject("Fee not found or was removed !");
        }
        const receipts = await this.service.getReceiptsByFeedId(feeId);
        if (receipts.length > 0) {
          return reject(`${fee.name} is linked to wages`);
        }
        return this.service.deleteManyFees([feeId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
