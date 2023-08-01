import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, Exam, FirestoreQuery, Period } from "../lib";
import { FireBase } from "../firebase";
import { ExamDeletedEvent, ExamEvents, ExamSavedEvent } from "../events/exams";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class ExamsService {
  private examsDb = FireBase.getCollection(AppRoutes.exams.api.INDEX);
  private periodsDb = FireBase.getCollection(AppRoutes.periods.api.INDEX);
  private exams: Exam[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  getPeriodsByExamId(examId: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Period[]>(async (resolve, reject) => {
      try {
        const snap = await this.periodsDb.where("exam_id", "==", examId.toString()).get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Period[] = snap.docs.map((doc) => {
          const period = new Period().toObject(doc.data());
          period.id = doc.id;
          return period;
        });
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  save(exam: Exam) {
    return new Promise<Exam>(async (resolve, reject) => {
      try {
        await exam.validate();
        const sanitized = AppUtils.sanitizeObject(exam);
        if (AppUtils.stringIsSet(exam.id)) {
          const entityBefore = await this.getExamById(exam.id);
          exam.setModified();
          return this.examsDb.doc(exam.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Exam()).toObject(exam);
              /*const index = this.exams.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.exams[index] = savedBr;
              } else {
                this.exams.push(savedBr);
              }*/
              this.exams.splice(0);
              this.eventEmitter.emit(ExamEvents.SAVE, new ExamSavedEvent(exam, entityBefore));
              return resolve((new Exam()).toObject(exam));
            })
            .catch((error) => reject(error));
        }
        return this.examsDb.add(sanitized)
          .then((result) => {
            const newExam = (new Exam()).toObject(exam);
            newExam.id = result.id;
            this.exams.push(newExam);
            this.eventEmitter.emit(ExamEvents.SAVE, new ExamSavedEvent(newExam, null));
            return resolve(newExam);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getExamById(id: string) {
    return new Promise<Exam | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported exam record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide exam identifier");
        }
        const snapshot = await this.examsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const exam = (new Exam()).toObject(rawData);
          exam.id = snapshot.id;
          return resolve(exam);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyExams = (examIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (examIds.length === 0) {
        return reject("select exams and try again");
      }
      let batch = this.examsDb.firestore.batch();
      examIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.examsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        examIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.exams.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.exams.splice(index, 1);
            }
            this.eventEmitter.emit(ExamEvents.DELETE, new ExamDeletedEvent(id));
          }
        });
        return resolve(result.length === examIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveExams(exams: Exam[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.examsDb.firestore.batch();
      for (const exam of exams) {
        exam.setModified();
        if (!AppUtils.stringIsSet(exam.id)) {
          batch = batch.create(this.examsDb.doc(), AppUtils.sanitizeObject(exam));
        } else {
          batch = batch.set(this.examsDb.doc(exam.id.toString()), AppUtils.sanitizeObject(exam));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.exams.splice(0);
          return resolve(saved.length === exams.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasExams() {
    return this.exams.length > 0;
  }

  getExamsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Exam[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasExams()) {
          console.log(`\n------------using existing ${this.exams.length} exams---------------\n`);
          // return resolve(this.exams);
        }
        let queryFn = this.examsDb.orderBy("created");
        if (options.valueOperator) {
          queryFn = this.examsDb.orderBy("value");
        }
        const set = new Set<FirestoreQuery>();
        if (options.name !== undefined) {
          set.add({ key: "name", operator: "==", value: options.name });
        }
        if (options.alias !== undefined) {
          set.add({ key: "alias", operator: "==", value: options.alias });
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
        const snap = await queryFn.get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Exam[] = snap.docs.map((doc) => {
          const exam = new Exam().toObject(doc.data());
          exam.id = doc.id;
          return exam;
        });
        if (!AppUtils.hasResponse(options)) {
          this.exams = results;
          console.log(`\n------------loaded ${this.exams.length} exams successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  addDefaultExams() {
    return new Promise<boolean>((resolve, reject) => {
      const data = [{ name: "Beginning Of Term", alias: "BOT", value: 1 }, {
        name: "Mid Term",
        alias: "MOT",
        value: 2
      }, { name: "End Of Term", alias: "EOT", value: 3 }];
      const exams = data.map((br) => {
        return new Exam(br.name, br.alias, br.value);
      });
      return this.saveExams(exams).then((ok) => resolve(ok)).catch((reason) => reject(reason));
    });
  }
}

