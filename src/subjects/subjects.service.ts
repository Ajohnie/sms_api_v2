import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, LevelsSubject, Subject } from "../lib";
import { FireBase } from "../firebase";
import { SubjectDeletedEvent, SubjectEvents, SubjectSavedEvent } from "../events/subjects";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class SubjectsService {
  private subjectsDb = FireBase.getCollection(AppRoutes.subjects.api.INDEX);
  private levelsSubjectsDb = FireBase.getCollection(AppRoutes.levels_subjects.api.INDEX);
  private subjects: Subject[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  getLevelsSubjectsBySubjectId(subjectId: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<LevelsSubject[]>(async (resolve, reject) => {
      try {
        const snap = await this.levelsSubjectsDb.where("subject_id", "==", subjectId.toString()).get();
        if (snap.empty) {
          return resolve([]);
        }
        const results: LevelsSubject[] = snap.docs.map((doc) => {
          const levelsSubject = new LevelsSubject().toObject(doc.data());
          levelsSubject.id = doc.id;
          return levelsSubject;
        });
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  save(subject: Subject) {
    return new Promise<Subject>(async (resolve, reject) => {
      try {
        await subject.validate();
        const sanitized = AppUtils.sanitizeObject(subject);
        if (AppUtils.stringIsSet(subject.id)) {
          const entityBefore = await this.getSubjectById(subject.id);
          subject.setModified();
          return this.subjectsDb.doc(subject.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Subject()).toObject(subject);
              const index = this.subjects.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.subjects[index] = savedBr;
              } else {
                this.subjects.push(savedBr);
              }
              this.eventEmitter.emit(SubjectEvents.SAVE, new SubjectSavedEvent(subject, entityBefore));
              return resolve((new Subject()).toObject(subject));
            })
            .catch((error) => reject(error));
        }
        return this.subjectsDb.add(sanitized)
          .then((result) => {
            const newSubject = (new Subject()).toObject(subject);
            newSubject.id = result.id;
            this.subjects.push(newSubject);
            this.eventEmitter.emit(SubjectEvents.SAVE, new SubjectSavedEvent(newSubject, null));
            return resolve(newSubject);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getSubjectById(id: string) {
    return new Promise<Subject | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported subject record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide subject identifier");
        }
        const snapshot = await this.subjectsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const subject = (new Subject()).toObject(rawData);
          subject.id = snapshot.id;
          return resolve(subject);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManySubjects = (subjectIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (subjectIds.length === 0) {
        return reject("select subjects and try again");
      }
      let batch = this.subjectsDb.firestore.batch();
      subjectIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.subjectsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        subjectIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.subjects.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.subjects.splice(index, 1);
            }
            this.eventEmitter.emit(SubjectEvents.DELETE, new SubjectDeletedEvent(id));
          }
        });
        return resolve(result.length === subjectIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveSubjects(subjects: Subject[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.subjectsDb.firestore.batch();
      for (const subject of subjects) {
        subject.setModified();
        if (!AppUtils.stringIsSet(subject.id)) {
          batch = batch.create(this.subjectsDb.doc(), AppUtils.sanitizeObject(subject));
        } else {
          batch = batch.set(this.subjectsDb.doc(subject.id.toString()), AppUtils.sanitizeObject(subject));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.subjects.splice(0);
          return resolve(saved.length === subjects.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasSubjects() {
    return this.subjects.length > 0;
  }

  getSubjectsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Subject[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasSubjects()) {
          console.log(`\n------------using existing ${this.subjects.length} subjects---------------\n`);
          // return resolve(this.subjects);
        }
        let queryFn = this.subjectsDb.orderBy("created");
        const set = new Set<FirestoreQuery>();
        if (options.name !== undefined) {
          set.add({ key: "name", operator: "==", value: options.name });
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
        let results: Subject[] = snap.docs.map((doc) => {
          const subject = new Subject().toObject(doc.data());
          subject.id = doc.id;
          return subject;
        });
        if (!AppUtils.hasResponse(options)) {
          this.subjects = results;
          console.log(`\n------------loaded ${this.subjects.length} subjects successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  addDefaultSubjects() {
    return new Promise<boolean>((resolve, reject) => {
      const subjects = [
        new Subject(null, "Mathematics", "math"),
        new Subject(null, "English", "eng"),
        new Subject(null, "Science", "sci"),
        new Subject(null, "Social Studies", "sst"),
        new Subject(null, "Reading", "reading"),
        new Subject(null, "Writing", "writing"),
        new Subject(null, "Religious Education", "re"),
        new Subject(null, "Luganda", "luganda"),
        new Subject(null, "Literacy", "lit")
      ];
      return this.saveSubjects(subjects).then((ok) => resolve(ok)).catch((reason) => reject(reason));
    });
  }

  getSubjectByName(name: string) {
    return new Promise<Subject | null>((resolve, reject) => {
      return this.subjectsDb.where("name", "==", name).get().then((snap) => {
        if (snap.empty) {
          return resolve(null);
        }
        const doc = snap.docs[0];
        const subject = (new Subject()).toObject(doc.data());
        subject.id = doc.id;
        return resolve(subject);
      }).catch((reason) => reject(reason));
    });
  }

  getSubjectByAlias(alias: string) {
    return new Promise<Subject | null>((resolve, reject) => {
      return this.subjectsDb.where("alias", "==", alias).get().then((snap) => {
        if (snap.empty) {
          return resolve(null);
        }
        const doc = snap.docs[0];
        const subject = (new Subject()).toObject(doc.data());
        subject.id = doc.id;
        return resolve(subject);
      }).catch((reason) => reject(reason));
    });
  }
}

