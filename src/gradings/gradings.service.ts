import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Grading } from "../lib";
import { FireBase } from "../firebase";
import { GradingDeletedEvent, GradingEvents, GradingSavedEvent } from "../events/gradings";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class GradingsService {
  private gradingsDb = FireBase.getCollection(AppRoutes.gradings.api.INDEX);
  private gradings: Grading[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  save(grading: Grading) {
    return new Promise<Grading>(async (resolve, reject) => {
      try {
        await grading.validate();
        const sanitized = AppUtils.sanitizeObject(grading);
        if (AppUtils.stringIsSet(grading.id)) {
          const entityBefore = await this.getGradingById(grading.id);
          grading.setModified();
          return this.gradingsDb.doc(grading.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Grading()).toObject(grading);
              /*const index = this.gradings.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.gradings[index] = savedBr;
              } else {
                this.gradings.push(savedBr);
              }*/
              this.gradings.splice(0);
              this.eventEmitter.emit(GradingEvents.SAVE, new GradingSavedEvent(grading, entityBefore));
              return resolve((new Grading()).toObject(grading));
            })
            .catch((error) => reject(error));
        }
        return this.gradingsDb.add(sanitized)
          .then((result) => {
            const newGrading = (new Grading()).toObject(grading);
            newGrading.id = result.id;
            this.gradings.push(newGrading);
            this.eventEmitter.emit(GradingEvents.SAVE, new GradingSavedEvent(newGrading, null));
            return resolve(newGrading);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getGradingById(id: string) {
    return new Promise<Grading | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported grading record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide grading identifier");
        }
        const snapshot = await this.gradingsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const grading = (new Grading()).toObject(rawData);
          grading.id = snapshot.id;
          return resolve(grading);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyGradings = (gradingIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (gradingIds.length === 0) {
        return reject("select gradings and try again");
      }
      let batch = this.gradingsDb.firestore.batch();
      gradingIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.gradingsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        gradingIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.gradings.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.gradings.splice(index, 1);
            }
            this.eventEmitter.emit(GradingEvents.DELETE, new GradingDeletedEvent(id));
          }
        });
        return resolve(result.length === gradingIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveGradings(gradings: Grading[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.gradingsDb.firestore.batch();
      for (const grading of gradings) {
        grading.setModified();
        if (!AppUtils.stringIsSet(grading.id)) {
          batch = batch.create(this.gradingsDb.doc(), AppUtils.sanitizeObject(grading));
        } else {
          batch = batch.set(this.gradingsDb.doc(grading.id.toString()), AppUtils.sanitizeObject(grading));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.gradings.splice(0);
          return resolve(saved.length === gradings.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasGradings() {
    return this.gradings.length > 0;
  }

  getGradingsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Grading[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasGradings()) {
          console.log(`\n------------using existing ${this.gradings.length} gradings---------------\n`);
          // return resolve(this.gradings);
        }
        let queryFn = this.gradingsDb.orderBy("created");
        const set = new Set<FirestoreQuery>();
        if (options.category !== undefined) {
          set.add({ key: "category", operator: "==", value: options.category });
        }
        if (options.date !== undefined) {
          const operator = options.dateOperator || "==";
          set.add({ key: "created", operator, value: AppUtils.getShortDate(options.date) });
        }
        queryFn = FireBase.getQueryReference(queryFn, set);
        if (options.startDate && options.endDate) {
          queryFn = FireBase.getEntitiesByDateRange(queryFn, options.startDate, options.endDate, true, "created");
        }
        if (options.level_alias !== undefined) {
          queryFn = queryFn.where("levels", "array-contains", options.level_alias);
        }
        const snap = await queryFn.get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Grading[] = snap.docs.map((doc) => {
          const grading = new Grading().toObject(doc.data());
          grading.id = doc.id;
          return grading;
        });
        if (!AppUtils.hasResponse(options)) {
          this.gradings = results;
          console.log(`\n------------loaded ${this.gradings.length} gradings successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }
}

