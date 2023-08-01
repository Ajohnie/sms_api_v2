import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, Fee, FirestoreQuery, Receipt, Transaction } from "../lib";
import { FireBase } from "../firebase";
import { FeeDeletedEvent, FeeEvents, FeeSavedEvent } from "../events/fees";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TransactionEvents, TransactionSavedEvent } from "../events/transactions";

@Injectable()
export class FeesService {
  private feesDb = FireBase.getCollection(AppRoutes.fees.api.INDEX);
  private receiptsDb = FireBase.getCollection(AppRoutes.receipts.api.INDEX);
  private transactionsDb = FireBase.getCollection(AppRoutes.transactions.api.INDEX);
  private fees: Fee[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

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

  getReceiptsByFeedId(feeId: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Receipt[]>(async (resolve, reject) => {
      try {
        const snap = await this.receiptsDb.where("expenseId", "==", feeId).get();
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

  save(fee: Fee) {
    return new Promise<Fee>((resolve, reject) => {
      return fee.validate().then(async () => {
        try {
          const sanitized = AppUtils.sanitizeObject(fee);
          if (AppUtils.stringIsSet(fee.id)) {
            const entityBefore = await this.getFeeById(fee.id);
            fee.setModified();
            return this.feesDb.doc(fee.id.toString())
              .set(sanitized)
              .then(() => {
                const savedBr = (new Fee()).toObject(fee);
                const index = this.fees.findIndex((prd) => prd.id === savedBr.id);
                if (index > -1) {
                  this.fees[index] = savedBr;
                } else {
                  this.fees.push(savedBr);
                }
                this.eventEmitter.emit(FeeEvents.SAVE, new FeeSavedEvent(fee.id));
                return resolve((new Fee()).toObject(fee));
              })
              .catch((error) => reject(error));
          }
          return this.feesDb.add(sanitized)
            .then((result) => {
              const newFee = (new Fee()).toObject(fee);
              newFee.id = result.id;
              this.fees.push(newFee);
              this.eventEmitter.emit(FeeEvents.SAVE, new FeeSavedEvent(newFee.id));
              return resolve(newFee);
            }).catch((error) => reject(error));
        } catch (e) {
          return reject(e);
        }
      }).catch((error) => reject(error));
    });
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

  deleteManyFees = (feeIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (feeIds.length === 0) {
        return reject("select fees and try again");
      }
      let batch = this.feesDb.firestore.batch();
      feeIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.feesDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        feeIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.fees.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.fees.splice(index, 1);
            }
            this.eventEmitter.emit(FeeEvents.DELETE, new FeeDeletedEvent(id));
          }
        });
        return resolve(result.length === feeIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveFees(fees: Fee[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.feesDb.firestore.batch();
      for (const fee of fees) {
        fee.setModified();
        if (!AppUtils.stringIsSet(fee.id)) {
          batch = batch.create(this.feesDb.doc(), AppUtils.sanitizeObject(fee));
        } else {
          batch = batch.set(this.feesDb.doc(fee.id.toString()), AppUtils.sanitizeObject(fee));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.fees.splice(0);
          return resolve(saved.length === fees.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasFees() {
    return this.fees.length > 0;
  }

  getFeesByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Fee[]>(async (resolve, reject) => {
      try {
        let queryFn = this.feesDb.orderBy("created");
        if (options.costOperator) {
          queryFn = this.feesDb.orderBy("cost");
        }
        const set = new Set<FirestoreQuery>();
        if (options.name !== undefined) {
          set.add({ key: "name", operator: "==", value: options.name });
        }
        if (options.cost !== undefined) {
          const operator = options.costOperator || "==";
          set.add({ key: "cost", operator, value: options.cost });
        }
        if (options.modifiedBy !== undefined) {
          set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
        }
        if (options.date !== undefined) {
          const operator = options.dateOperator || "==";
          set.add({ key: "created", operator, value: AppUtils.getShortDate(options.date) });
        }
        queryFn = FireBase.getQueryReference(queryFn, set);
        if (options.startDate && options.endDate) {
          queryFn = FireBase.getEntitiesByDateRange(queryFn,
            options.startDate,
            options.endDate,
            true, "created");
        }
        const snap = await queryFn.get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Fee[] = snap.docs.map((doc) => {
          const fee = new Fee().toObject(doc.data());
          fee.id = doc.id;
          return fee;
        });
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }
}

