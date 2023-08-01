import { Injectable } from "@nestjs/common";
import {
  AppRoutes,
  AppUtils,
  ExpenseType,
  Fee,
  FirestoreQuery,
  Level,
  Period,
  Receipt,
  Student,
  Transaction
} from "../lib";
import { FireBase } from "../firebase";
import { ReceiptDeletedEvent, ReceiptEvents, ReceiptSavedEvent } from "../events/receipts";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TransactionDeletedEvent, TransactionEvents, TransactionSavedEvent } from "../events/transactions";

@Injectable()
export class ReceiptsService {
  private receiptsDb = FireBase.getCollection(AppRoutes.receipts.api.INDEX);
  private feesDb = FireBase.getCollection(AppRoutes.fees.api.INDEX);
  private periodsDb = FireBase.getCollection(AppRoutes.periods.api.INDEX);
  private studentsDb = FireBase.getCollection(AppRoutes.students.api.INDEX);
  private levelsDb = FireBase.getCollection(AppRoutes.levels.api.INDEX);
  private transactionsDb = FireBase.getCollection(AppRoutes.transactions.api.INDEX);
  private receipts: Receipt[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  getFeeById(id: string) {
    return new Promise<Fee | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported fee record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide fee identifier");
        }
        const snapshot = await this.feesDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const fee = (new Fee()).toObject(rawData);
          fee.id = snapshot.id;
          return resolve(fee);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  getTransactionsByRefNo(refNo: string) {
    return new Promise<Transaction[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(refNo)) {
          return reject("provide transaction refNo and try again");
        }
        const snap = await this.transactionsDb
          .where("referenceNo", "==", refNo.toString())
          .where("type", "==", ExpenseType.Receipt)
          .get();
        if (snap.empty) {
          return resolve([]);
        }
        const results: Transaction[] = snap.docs.map((doc) => {
          const transaction = new Transaction().toObject(doc.data());
          transaction.id = doc.id;
          return transaction;
        });
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyTransactions = (transactionIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (transactionIds.length === 0) {
        return reject("select transactions and try again");
      }
      let batch = this.transactionsDb.firestore.batch();
      transactionIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.transactionsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        transactionIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            this.eventEmitter.emit(TransactionEvents.DELETE, new TransactionDeletedEvent(id));
          }
        });
        return resolve(result.length === transactionIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveTransaction(transaction: Transaction) {
    return new Promise<Transaction>(async (resolve, reject) => {
      try {
        await transaction.validate();
        const sanitized = AppUtils.sanitizeObject(transaction);
        if (AppUtils.stringIsSet(transaction.id)) {
          transaction.setModified();
          return this.transactionsDb.doc(transaction.id.toString())
            .set(sanitized)
            .then(() => {
              const saved = (new Transaction()).toObject(transaction);
              this.eventEmitter.emit(TransactionEvents.SAVE, new TransactionSavedEvent(saved));
              return resolve((new Transaction()).toObject(transaction));
            })
            .catch((error) => reject(error));
        }
        return this.transactionsDb.add(sanitized)
          .then((result) => {
            const newTransaction = (new Transaction()).toObject(transaction);
            newTransaction.id = result.id;
            this.eventEmitter.emit(TransactionEvents.SAVE, new TransactionSavedEvent(newTransaction));
            return resolve(newTransaction);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getPeriodById(id: string) {
    return new Promise<Period | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported period record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide period identifier");
        }
        const snapshot = await this.periodsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const period = (new Period()).toObject(rawData);
          period.id = snapshot.id;
          return resolve(period);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  getLevelById(id: string) {
    return new Promise<Level | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported level record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide level identifier");
        }
        const snapshot = await this.levelsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const level = (new Level()).toObject(rawData);
          level.id = snapshot.id;
          return resolve(level);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  getStudentById(id: string) {
    return new Promise<Student | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported student record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide student identifier");
        }
        const snapshot = await this.studentsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const student = (new Student()).toObject(rawData);
          student.id = snapshot.id;
          return resolve(student);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  save(receipt: Receipt) {
    return new Promise<Receipt>((resolve, reject) => {
      return receipt.validate().then(async () => {
        try {
          const sanitized = AppUtils.sanitizeObject(receipt);
          sanitized.fee = null;
          sanitized.transactions = [];
          if (AppUtils.stringIsSet(receipt.id)) {
            receipt.setModified();
            return this.receiptsDb.doc(receipt.id.toString())
              .set(sanitized)
              .then(() => {
                const savedBr = (new Receipt()).toObject(receipt);
                const index = this.receipts.findIndex((prd) => prd.id === savedBr.id);
                if (index > -1) {
                  this.receipts[index] = savedBr;
                } else {
                  this.receipts.push(savedBr);
                }
                this.eventEmitter.emit(ReceiptEvents.SAVE, new ReceiptSavedEvent(receipt));
                return resolve((new Receipt()).toObject(receipt));
              })
              .catch((error) => reject(error));
          }
          return this.receiptsDb.add(sanitized)
            .then((result) => {
              const newReceipt = (new Receipt()).toObject(receipt);
              newReceipt.id = result.id;
              this.receipts.push(newReceipt);
              this.eventEmitter.emit(ReceiptEvents.SAVE, new ReceiptSavedEvent(newReceipt));
              return resolve(newReceipt);
            }).catch((error) => reject(error));
        } catch (e) {
          return reject(e);
        }
      }).catch((error) => reject(error));
    });
  }

  getReceiptById(id: string) {
    return new Promise<Receipt | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported receipt record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide receipt identifier");
        }
        const snapshot = await this.receiptsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const receipt = (new Receipt()).toObject(rawData);
          receipt.id = snapshot.id;
          return resolve(receipt);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyReceipts = (receiptIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (receiptIds.length === 0) {
        return reject("select receipts and try again");
      }
      let batch = this.receiptsDb.firestore.batch();
      receiptIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.receiptsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        receiptIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.receipts.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.receipts.splice(index, 1);
            }
            this.eventEmitter.emit(ReceiptEvents.DELETE, new ReceiptDeletedEvent(id));
          }
        });
        return resolve(result.length === receiptIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveReceipts(receipts: Receipt[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.receiptsDb.firestore.batch();
      for (const receipt of receipts) {
        receipt.setModified();
        if (!AppUtils.stringIsSet(receipt.id)) {
          batch = batch.create(this.receiptsDb.doc(), AppUtils.sanitizeObject(receipt));
        } else {
          batch = batch.set(this.receiptsDb.doc(receipt.id.toString()), AppUtils.sanitizeObject(receipt));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.receipts.splice(0);
          return resolve(saved.length === receipts.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasReceipts() {
    return this.receipts.length > 0;
  }

  getReceiptsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Receipt[]>(async (resolve, reject) => {
      try {
        if (options.receiptId !== undefined) {
          return this.getReceiptById(options.receiptId).then((receipt) => {
            if (receipt) {
              return resolve([receipt]);
            }
            return resolve([]);
          });
        }
        let queryFn = this.receiptsDb.orderBy("date");
        if (options.balanceOperator) {
          queryFn = this.receiptsDb.orderBy("balance");
        }
        if (options.amountOperator) {
          queryFn = this.receiptsDb.orderBy("amount");
        }
        if (options.dateOperator) {
          queryFn = this.receiptsDb.orderBy("date");
        }
        const set = new Set<FirestoreQuery>();
        if (AppUtils.stringIsSet(options.period_id)) {
          set.add({ key: "period_id", operator: "==", value: options.period_id });
        }
        if (AppUtils.stringIsSet(options.level_id)) {
          set.add({ key: "level_id", operator: "==", value: options.level_id });
        }
        if (options.student_id !== undefined) {
          set.add({ key: "student_id", operator: "==", value: options.student_id });
        }
        if (AppUtils.stringIsSet(options.fee_id)) {
          set.add({ key: "fee_id", operator: "==", value: options.fee_id });
        }
        if (options.mode !== undefined) {
          set.add({ key: "mode", operator: "==", value: options.mode });
        }
        if (options.modifiedBy !== undefined) {
          set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
        }
        if (options.particulars !== undefined) {
          set.add({ key: "particulars", operator: "==", value: options.particulars });
        }
        if (options.amount !== undefined) {
          const operator = options.amountOperator || "==";
          set.add({ key: "amount", operator, value: options.amount.toString() });
        }
        if (options.balance !== undefined) {
          const operator = options.balanceOperator || "==";
          set.add({ key: "balance", operator, value: options.balance.toString() });
        }
        if (options.date !== undefined) {
          const operator = options.dateOperator || "==";
          set.add({ key: "date", operator, value: AppUtils.getShortDate(options.date) });
        }
        queryFn = FireBase.getQueryReference(queryFn, set);
        if (options.startDate && options.endDate) {
          queryFn = FireBase.getEntitiesByDateRange(queryFn, options.startDate, options.endDate);
        }
        const snap = await queryFn.get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Receipt[] = snap.docs.map((doc) => {
          const receipt = new Receipt().toObject(doc.data());
          receipt.id = doc.id;
          return receipt;
        });
        if (!AppUtils.hasResponse(options)) {
          this.receipts = results;
          console.log(`\n------------loaded ${this.receipts.length} receipts successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  getTotalReceipts = (options: any) => {
    return new Promise<number>(async (resolve, reject) => {
      try {
        const receipts = await this.getReceiptsByOptions(options);
        const total = AppUtils.mapReduceToNum(receipts, "total");
        return resolve(total);
      } catch (e) {
        return reject(e?.toString());
      }
    });
  };
}

