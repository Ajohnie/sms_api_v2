import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Period, Term } from "../lib";
import { FireBase } from "../firebase";
import { TermDeletedEvent, TermEvents, TermSavedEvent } from "../events/terms";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class TermsService {
  private termsDb = FireBase.getCollection(AppRoutes.terms.api.INDEX);
  private periodsDb = FireBase.getCollection(AppRoutes.periods.api.INDEX);
  private terms: Term[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  getPeriodsByTermId(termId: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Period[]>(async (resolve, reject) => {
      try {
        const snap = await this.periodsDb.where("term_id", "==", termId.toString()).get();
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
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  save(term: Term) {
    return new Promise<Term>(async (resolve, reject) => {
      try {
        await term.validate();
        const sanitized = AppUtils.sanitizeObject(term);
        sanitized.missingMarks = {};
        sanitized.nines = {};
        sanitized.exams = [];
        if (AppUtils.stringIsSet(term.id)) {
          const entityBefore = await this.getTermById(term.id);
          term.setModified();
          return this.termsDb.doc(term.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Term()).toObject(term);
              const index = this.terms.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.terms[index] = savedBr;
              } else {
                this.terms.push(savedBr);
              }
              this.eventEmitter.emit(TermEvents.SAVE, new TermSavedEvent(term, entityBefore));
              return resolve((new Term()).toObject(term));
            })
            .catch((error) => reject(error));
        }
        return this.termsDb.add(sanitized)
          .then((result) => {
            const newTerm = (new Term()).toObject(term);
            newTerm.id = result.id;
            this.terms.push(newTerm);
            this.eventEmitter.emit(TermEvents.SAVE, new TermSavedEvent(newTerm, null));
            return resolve(newTerm);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
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

  deleteManyTerms = (termIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (termIds.length === 0) {
        return reject("select terms and try again");
      }
      let batch = this.termsDb.firestore.batch();
      termIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.termsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        termIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.terms.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.terms.splice(index, 1);
            }
            this.eventEmitter.emit(TermEvents.DELETE, new TermDeletedEvent(id));
          }
        });
        return resolve(result.length === termIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveTerms(terms: Term[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.termsDb.firestore.batch();
      for (const term of terms) {
        term.setModified();
        if (!AppUtils.stringIsSet(term.id)) {
          batch = batch.create(this.termsDb.doc(), AppUtils.sanitizeObject(term));
        } else {
          batch = batch.set(this.termsDb.doc(term.id.toString()), AppUtils.sanitizeObject(term));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.terms.splice(0);
          return resolve(saved.length === terms.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasTerms() {
    return this.terms.length > 0;
  }

  getTermsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Term[]>((resolve, reject) => {
      if (!AppUtils.hasResponse(options) && this.hasTerms()) {
        console.log(`\n------------using existing ${this.terms.length} terms---------------\n`);
        // return resolve(this.terms);
      }
      let queryFn = this.termsDb.orderBy("created");
      if (options.valueOperator) {
        queryFn = this.termsDb.orderBy("value");
      }
      const set = new Set<FirestoreQuery>();
      if (options.name !== undefined) {
        set.add({ key: "name", operator: "==", value: options.name });
      }
      if (options.value !== undefined) {
        const operator = options.valueOperator || "==";
        set.add({ key: "value", operator, value: options.value });
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
      return queryFn.get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const terms: Term[] = snap.docs.map((doc) => {
          const term = new Term().toObject(doc.data());
          term.id = doc.id;
          return term;
        });
        if (!AppUtils.hasResponse(options)) {
          this.terms = terms;
          console.log(`\n------------loaded ${this.terms.length} terms successfully---------------\n`);
        }
        return resolve(terms);
      }).catch((reason) => reject(reason));
    });
  }

  addDefaultTerms() {
    return new Promise<boolean>((resolve, reject) => {
      const data = [{ name: "Term 1", value: 1 }, { name: "Term 2", value: 2 }, { name: "Term 3", value: 3 }];
      const terms = data.map((br) => {
        return new Term(br.value, br.name, br.value);
      });
      return this.saveTerms(terms).then((ok) => resolve(ok)).catch((reason) => reject(reason));
    });
  }
}

