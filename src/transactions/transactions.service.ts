import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Receipt, Transaction } from "../lib";
import { FireBase } from "../firebase";
import { TransactionDeletedEvent, TransactionEvents, TransactionSavedEvent } from "../events/transactions";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ReceiptEvents, ReceiptSavedEvent } from "../events/receipts";

@Injectable()
export class TransactionsService {
  private transactionsDb = FireBase.getCollection(AppRoutes.transactions.api.INDEX);
  private receiptsDb = FireBase.getCollection(AppRoutes.receipts.api.INDEX);
  private transactions: Transaction[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  saveReceipt(receipt: Receipt) {
    return new Promise<Receipt>(async (resolve, reject) => {
      try {
        await receipt.validate();
        const sanitized = AppUtils.sanitizeObject(receipt);
        if (AppUtils.stringIsSet(receipt.id)) {
          receipt.setModified();
          return this.receiptsDb.doc(receipt.id.toString())
            .set(sanitized)
            .then(() => {
              const saved = (new Receipt()).toObject(receipt);
              this.eventEmitter.emit(ReceiptEvents.SAVE, new ReceiptSavedEvent(saved));
              return resolve((new Receipt()).toObject(receipt));
            })
            .catch((error) => reject(error));
        }
        return this.receiptsDb.add(sanitized)
          .then((result) => {
            const newReceipt = (new Receipt()).toObject(receipt);
            newReceipt.id = result.id;
            return resolve(newReceipt);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
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

  getReceiptsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Receipt[]>(async (resolve, reject) => {
      try {
        if (options.receiptId !== undefined) {
          return this.getReceiptById(options.receiptId).then((receipts) => {
            if (receipts) {
              return resolve([receipts]);
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
        if (AppUtils.stringIsSet(options.referenceNo)) {
          set.add({ key: "referenceNo", operator: "==", value: options.referenceNo });
        }
        if (options.mode !== undefined) {
          set.add({ key: "mode", operator: "==", value: options.mode });
        }
        if (options.no !== undefined) {
          set.add({ key: "no", operator: "==", value: options.no });
        }
        if (options.type !== undefined) {
          set.add({ key: "type", operator: "==", value: options.type });
        }
        if (options.modifiedBy !== undefined) {
          set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
        }
        if (options.name !== undefined) {
          set.add({ key: "name", operator: "==", value: options.name });
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
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  save(transaction: Transaction) {
    return new Promise<Transaction>((resolve, reject) => {
      return transaction.validate().then(async () => {
        try {
          const sanitized = AppUtils.sanitizeObject(transaction);
          if (AppUtils.stringIsSet(transaction.id)) {
            transaction.setModified();
            return this.transactionsDb.doc(transaction.id.toString())
              .set(sanitized)
              .then(() => {
                const savedBr = (new Transaction()).toObject(transaction);
                const index = this.transactions.findIndex((prd) => prd.id === savedBr.id);
                if (index > -1) {
                  this.transactions[index] = savedBr;
                } else {
                  this.transactions.push(savedBr);
                }
                this.eventEmitter.emit(TransactionEvents.SAVE, new TransactionSavedEvent(transaction));
                return resolve((new Transaction()).toObject(transaction));
              })
              .catch((error) => reject(error));
          }
          return this.transactionsDb.add(sanitized)
            .then((result) => {
              const newTransaction = (new Transaction()).toObject(transaction);
              newTransaction.id = result.id;
              this.transactions.push(newTransaction);
              this.eventEmitter.emit(TransactionEvents.SAVE, new TransactionSavedEvent(newTransaction));
              return resolve(newTransaction);
            }).catch((error) => reject(error));
        } catch (e) {
          return reject(e);
        }
      }).catch((error) => reject(error));
    });
  }

  getTransactionById(id: string) {
    return new Promise<Transaction | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported transaction record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide transaction identifier");
        }
        const snapshot = await this.transactionsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const transaction = (new Transaction()).toObject(rawData);
          transaction.id = snapshot.id;
          return resolve(transaction);
        }
        return resolve(null);
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
            const index = this.transactions.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.transactions.splice(index, 1);
            }
            this.eventEmitter.emit(TransactionEvents.DELETE, new TransactionDeletedEvent(id));
          }
        });
        return resolve(result.length === transactionIds.length);
      }).catch((error) => reject(error));
    });
  };
  deleteTransaction = (transactionId: any) => {
    return new Promise<boolean>((resolve, reject) => {
      if (!AppUtils.stringIsSet(transactionId)) {
        return reject("select transaction and try again");
      }
      return this.transactionsDb.doc(transactionId.toString()).delete().then((result) => {
        this.eventEmitter.emit(TransactionEvents.DELETE, new TransactionDeletedEvent(transactionId));
        return resolve(true);
      }).catch((error) => reject(error));
    });
  };

  saveTransactions(transactions: Transaction[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.transactionsDb.firestore.batch();
      for (const transaction of transactions) {
        transaction.setModified();
        if (!AppUtils.stringIsSet(transaction.id)) {
          batch = batch.create(this.transactionsDb.doc(), AppUtils.sanitizeObject(transaction));
        } else {
          batch = batch.set(this.transactionsDb.doc(transaction.id.toString()), AppUtils.sanitizeObject(transaction));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.transactions.splice(0);
          return resolve(saved.length === transactions.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasTransactions() {
    return this.transactions.length > 0;
  }

  getTransactionsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Transaction[]>(async (resolve, reject) => {
      try {
        if (options.transactionId !== undefined) {
          return this.getTransactionById(options.transactionId).then((transactions) => {
            if (transactions) {
              return resolve([transactions]);
            }
            return resolve([]);
          });
        }
        let queryFn = this.transactionsDb.orderBy("date");
        if (options.balanceOperator) {
          queryFn = this.transactionsDb.orderBy("balance");
        }
        if (options.amountOperator) {
          queryFn = this.transactionsDb.orderBy("amount");
        }
        if (options.dateOperator) {
          queryFn = this.transactionsDb.orderBy("date");
        }
        const set = new Set<FirestoreQuery>();
        if (AppUtils.stringIsSet(options.referenceNo)) {
          set.add({ key: "referenceNo", operator: "==", value: options.referenceNo });
        }
        if (options.mode !== undefined) {
          set.add({ key: "mode", operator: "==", value: options.mode });
        }
        if (options.no !== undefined) {
          set.add({ key: "no", operator: "==", value: options.no });
        }
        if (options.type !== undefined) {
          set.add({ key: "type", operator: "==", value: options.type });
        }
        if (options.modifiedBy !== undefined) {
          set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
        }
        if (options.name !== undefined) {
          set.add({ key: "name", operator: "==", value: options.name });
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
        let results: Transaction[] = snap.docs.map((doc) => {
          const transaction = new Transaction().toObject(doc.data());
          transaction.id = doc.id;
          return transaction;
        });
        if (!AppUtils.hasResponse(options)) {
          this.transactions = results;
          console.log(`\n------------loaded ${this.transactions.length} transactions successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  getTotalTransactions = (options: any) => {
    return new Promise<number>(async (resolve, reject) => {
      try {
        const transactions = await this.getTransactionsByOptions(options);
        let total = 0;
        const amountMap = transactions.map((transaction) => transaction.amount);
        if (amountMap.length > 0) {
          total = amountMap.reduce((cv, pv) => AppUtils.add(cv, pv));
        }
        return resolve(total);
      } catch (e) {
        return reject(e?.toString());
      }
    });
  };
}

