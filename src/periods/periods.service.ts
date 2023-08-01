import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Period, Term } from "../lib";
import { FireBase } from "../firebase";
import { PeriodDeletedEvent, PeriodEvents, PeriodSavedEvent } from "../events/periods";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { endOfYear, startOfYear } from "date-fns";

@Injectable()
export class PeriodsService {
  private periodsDb = FireBase.getCollection(AppRoutes.periods.api.INDEX);
  private termsDb = FireBase.getCollection(AppRoutes.terms.api.INDEX);
  private periods: Period[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  save(period: Period) {
    return new Promise<Period>(async (resolve, reject) => {
      try {
        await period.validate();
        const sanitized = AppUtils.sanitizeObject(period);
        sanitized.term = null;
        if (AppUtils.stringIsSet(period.id)) {
          const entityBefore = await this.getPeriodById(period.id);
          period.setModified();
          return this.periodsDb.doc(period.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Period()).toObject(period);
              const index = this.periods.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.periods[index] = savedBr;
              } else {
                this.periods.push(savedBr);
              }
              this.eventEmitter.emit(PeriodEvents.SAVE, new PeriodSavedEvent(period, entityBefore));
              return resolve((new Period()).toObject(period));
            })
            .catch((error) => reject(error));
        }
        return this.periodsDb.add(sanitized)
          .then((result) => {
            const newPeriod = (new Period()).toObject(period);
            newPeriod.id = result.id;
            this.periods.push(newPeriod);
            this.eventEmitter.emit(PeriodEvents.SAVE, new PeriodSavedEvent(newPeriod, null));
            return resolve(newPeriod);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getCurrentPeriod = (): Promise<Period | null> => {
    return new Promise<Period | null>((resolve, reject) => {
      const now = new Date();
      const startDate = startOfYear(now);
      const endDate = endOfYear(now);
      return this.getPeriodsByOptions({
        startDate,
        endDate
      }).then((periods) => {
        if (periods.length === 0) {
          return resolve(null);
        }
        if (periods.length === 1) {
          return resolve(periods[0]);
        }
        const sortedToTerms = periods
          .sort((a, b) => AppUtils.sortComp(a.term.value.toLocaleString(), b.term.value.toLocaleString()));
        return resolve(sortedToTerms[0]);
      }).catch((reason) => reject(reason));
    });
  };

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
          period.term = (await this.getTermById(period.term_id)) || new Term();
          return resolve(period);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyPeriods = (periodIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (periodIds.length === 0) {
        return reject("select periods and try again");
      }
      let batch = this.periodsDb.firestore.batch();
      periodIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.periodsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        periodIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.periods.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.periods.splice(index, 1);
            }
            this.eventEmitter.emit(PeriodEvents.DELETE, new PeriodDeletedEvent(id));
          }
        });
        return resolve(result.length === periodIds.length);
      }).catch((error) => reject(error));
    });
  };

  savePeriods(periods: Period[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.periodsDb.firestore.batch();
      for (const period of periods) {
        period.setModified();
        if (!AppUtils.stringIsSet(period.id)) {
          batch = batch.create(this.periodsDb.doc(), AppUtils.sanitizeObject(period));
        } else {
          batch = batch.set(this.periodsDb.doc(period.id.toString()), AppUtils.sanitizeObject(period));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.periods.splice(0);
          return resolve(saved.length === periods.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasPeriods() {
    return this.periods.length > 0;
  }

  getTermById(id: string) {
    return new Promise<Term | null>((resolve, reject) => {
      if (typeof id === "object") {
        return reject(`unsupported term record identifier, contact admin`);
      }
      if (!AppUtils.stringIsSet(id)) {
        return reject("provide term identifier");
      }
      return this.termsDb.doc(id.toString()).get().then((snapshot) => {
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const term = (new Term()).toObject(rawData);
          term.id = snapshot.id;
          return resolve(term);
        }
        return resolve(null);
      }).catch((error) => reject(error));
    });
  }

  getPeriodsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Period[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasPeriods()) {
          console.log(`\n------------using existing ${this.periods.length} periods---------------\n`);
          // return resolve(this.periods);
        }
        let queryFn = this.periodsDb.orderBy("created");
        if (options.dateOperator) {
          queryFn = this.periodsDb.orderBy("start_date");
        }
        const set = new Set<FirestoreQuery>();
        if (options.date !== undefined) {
          const operator = options.dateOperator || "==";
          set.add({ key: "start_date", operator, value: AppUtils.getShortDate(options.date) });
        }
        if (options.term_id !== undefined) {
          set.add({ key: "term_id", operator: "==", value: options.term_id.toString() });
        }
        queryFn = FireBase.getQueryReference(queryFn, set);
        if (options.startDate && options.endDate) {
          set.add({ key: "start_date", operator: ">=", value: AppUtils.getShortDate(options.startDate) });
          set.add({ key: "end_date", operator: "<=", value: AppUtils.getShortDate(options.endDate) });
        }
        const snap = await queryFn.get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Period[] = snap.docs.map((doc) => {
          const period = new Period().toObject(doc.data());
          period.id = doc.id;
          return period;
        });
        // load corresponding terms
        for (const period of results) {
          period.term = (await this.getTermById(period.term_id)) || new Term();
        }
        if (options.name !== undefined) {
          results = results.filter((period) => period.hasName(options.name));
        }
        if (!AppUtils.hasResponse(options)) {
          this.periods = results;
          console.log(`\n------------loaded ${this.periods.length} periods successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }
}

