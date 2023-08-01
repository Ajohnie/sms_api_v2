import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Grade, Grading } from "../lib";
import { FireBase } from "../firebase";
import { GradeDeletedEvent, GradeEvents, GradeSavedEvent } from "../events/grades";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class GradesService {
  private gradesDb = FireBase.getCollection(AppRoutes.grades.api.INDEX);
  private gradingsDb = FireBase.getCollection(AppRoutes.gradings.api.INDEX);
  private grades: Grade[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  save(grade: Grade) {
    return new Promise<Grade>(async (resolve, reject) => {
      try {
        grade.setId();
        await grade.validate();
        const sanitized = AppUtils.sanitizeObject(grade);
        if (AppUtils.stringIsSet(grade.id)) {
          const entityBefore = await this.getGradeById(grade.id);
          grade.setModified();
          return this.gradesDb.doc(grade.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Grade()).toObject(grade);
              const index = this.grades.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.grades[index] = savedBr;
              } else {
                this.grades.push(savedBr);
              }
              this.eventEmitter.emit(GradeEvents.SAVE, new GradeSavedEvent(grade, entityBefore));
              return resolve((new Grade()).toObject(grade));
            })
            .catch((error) => reject(error));
        }
        return this.gradesDb.add(sanitized)
          .then((result) => {
            const newGrade = (new Grade()).toObject(grade);
            newGrade.id = result.id;
            this.grades.push(newGrade);
            this.eventEmitter.emit(GradeEvents.SAVE, new GradeSavedEvent(newGrade, null));
            return resolve(newGrade);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  saveGrading(grading: Grading) {
    return new Promise<Grading>(async (resolve, reject) => {
      try {
        await grading.validate();
        const sanitized = AppUtils.sanitizeObject(grading);
        if (AppUtils.stringIsSet(grading.id)) {
          grading.setModified();
          return this.gradingsDb.doc(grading.id.toString())
            .set(sanitized)
            .then(() => {
              return resolve((new Grading()).toObject(grading));
            })
            .catch((error) => reject(error));
        }
        return this.gradingsDb.add(sanitized)
          .then((result) => {
            const newGrading = (new Grading()).toObject(grading);
            newGrading.id = result.id;
            return resolve(newGrading);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getGradeById(id: string) {
    return new Promise<Grade | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported grade record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide grade identifier");
        }
        const snapshot = await this.gradesDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const grade = (new Grade()).toObject(rawData);
          grade.id = snapshot.id;
          return resolve(grade);
        }
        return resolve(null);
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

  deleteManyGrades = (gradeIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (gradeIds.length === 0) {
        return reject("select grades and try again");
      }
      let batch = this.gradesDb.firestore.batch();
      gradeIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.gradesDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        gradeIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.grades.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.grades.splice(index, 1);
            }
            this.eventEmitter.emit(GradeEvents.DELETE, new GradeDeletedEvent(id));
          }
        });
        return resolve(result.length === gradeIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveGrades(grades: Grade[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.gradesDb.firestore.batch();
      for (const grade of grades) {
        grade.setModified();
        if (!AppUtils.stringIsSet(grade.id)) {
          batch = batch.create(this.gradesDb.doc(), AppUtils.sanitizeObject(grade));
        } else {
          batch = batch.set(this.gradesDb.doc(grade.id.toString()), AppUtils.sanitizeObject(grade));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.grades.splice(0);
          return resolve(saved.length === grades.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasGrades() {
    return this.grades.length > 0;
  }

  getGradesByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Grade[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasGrades()) {
          console.log(`\n------------using existing ${this.grades.length} grades---------------\n`);
          // return resolve(this.grades);
        }
        let queryFn = this.gradesDb.orderBy("created");
        const set = new Set<FirestoreQuery>();
        if (options.grading_id !== undefined) {
          set.add({ key: "grading_id", operator: "==", value: options.grading_id });
        }
        if (options.code !== undefined) {
          set.add({ key: "code", operator: "==", value: options.code });
        }
        if (options.lower_limit !== undefined) {
          const lower_limit_opp = AppUtils.stringIsSet(options.lower_limit_op) ? options.lower_limit_op : "==";
          set.add({ key: "lower_limit", operator: lower_limit_opp, value: options.lower_limit });
        }
        if (options.upper_limit !== undefined) {
          const upper_limit_opp = AppUtils.stringIsSet(options.upper_limit_op) ? options.upper_limit_op : "==";
          set.add({ key: "upper_limit", operator: upper_limit_opp, value: options.upper_limit });
        }
        if (options.date !== undefined) {
          const operator = options.dateOperator || "==";
          set.add({ key: "created", operator, value: AppUtils.getShortDate(options.date) });
        }
        queryFn = FireBase.getQueryReference(queryFn, set);
        if (options.startDate && options.endDate) {
          queryFn = FireBase.getEntitiesByDateRange(queryFn, options.startDate, options.endDate, true, "created");
        }
        const snap = await queryFn.get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Grade[] = snap.docs.map((doc) => {
          const grade = new Grade().toObject(doc.data());
          grade.id = doc.id;
          return grade;
        });
        if (!AppUtils.hasResponse(options)) {
          this.grades = results;
          console.log(`\n------------loaded ${this.grades.length} grades successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  getGrade = (grading_id: any, score: number) => {
    return new Promise<Grade | null>(async (resolve, reject) => {
      const scoreValid = (score >= 0 && score <= 100);
      if (!scoreValid) {
        return reject(`score must be between 0 and 100`);
      }
      if (!AppUtils.stringIsSet(grading_id)) {
        return reject(`set grading for score ${score} and try again`);
      }
      const options = {
        lower_limit: score,
        upper_limit: score,
        lower_limit_opp: ">=",
        upper_limit_opp: "<=",
        grading_id
      };
      try {
        const grades = (await this.getGradesByOptions(options));
        if (grades.length === 0) {
          return reject(`score ${score} has no matching grade`);
        }
        return resolve(grades[0]);
      } catch (e) {
        return reject(e);
      }
    });
  };
}

