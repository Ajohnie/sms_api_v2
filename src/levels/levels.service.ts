import { Injectable } from "@nestjs/common";
import {
  AppRoutes,
  AppUtils,
  Enrollment,
  FirestoreQuery,
  Grading,
  Level,
  LevelsStream,
  LevelsSubject,
  Stream,
  Subject,
  Teacher
} from "../lib";
import { FireBase } from "../firebase";
import { LevelDeletedEvent, LevelEvents, LevelSavedEvent } from "../events/levels";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class LevelsService {
  private levelsDb = FireBase.getCollection(AppRoutes.levels.api.INDEX);
  private gradingsDb = FireBase.getCollection(AppRoutes.gradings.api.INDEX);
  private teachersDb = FireBase.getCollection(AppRoutes.teachers.api.INDEX);
  private streamsDb = FireBase.getCollection(AppRoutes.streams.api.INDEX);
  private subjectsDb = FireBase.getCollection(AppRoutes.subjects.api.INDEX);
  private levels: Level[] = [];
  private enrollmentsDb = FireBase.getCollection(AppRoutes.enrollments.api.INDEX);
  private levelsStreamsDb = FireBase.getCollection(AppRoutes.levels_streams.api.INDEX);
  private levelsSubjectsDb = FireBase.getCollection(AppRoutes.levels_subjects.api.INDEX);

  constructor(private eventEmitter: EventEmitter2) {
  }

  save(level: Level) {
    return new Promise<Level>(async (resolve, reject) => {
      try {
        await level.validate();
        const sanitized = AppUtils.sanitizeObject(level);
        if (AppUtils.stringIsSet(level.id)) {
          const entityBefore = await this.getLevelById(level.id);
          level.setModified();
          return this.levelsDb.doc(level.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Level()).toObject(level);
              const index = this.levels.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.levels[index] = savedBr;
              } else {
                this.levels.push(savedBr);
              }
              this.eventEmitter.emit(LevelEvents.SAVE, new LevelSavedEvent(level, entityBefore));
              return resolve((new Level()).toObject(level));
            })
            .catch((error) => reject(error));
        }
        return this.levelsDb.add(sanitized)
          .then((result) => {
            const newLevel = (new Level()).toObject(level);
            newLevel.id = result.id;
            this.levels.push(newLevel);
            this.eventEmitter.emit(LevelEvents.SAVE, new LevelSavedEvent(newLevel, null));
            return resolve(newLevel);
          }).catch((error) => reject(error));
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

  deleteManyLevels = (levelIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (levelIds.length === 0) {
        return reject("select levels and try again");
      }
      let batch = this.levelsDb.firestore.batch();
      levelIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.levelsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        levelIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.levels.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.levels.splice(index, 1);
            }
            this.eventEmitter.emit(LevelEvents.DELETE, new LevelDeletedEvent(id));
          }
        });
        return resolve(result.length === levelIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveLevels(levels: Level[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.levelsDb.firestore.batch();
      for (const level of levels) {
        level.setModified();
        if (!AppUtils.stringIsSet(level.id)) {
          batch = batch.create(this.levelsDb.doc(), AppUtils.sanitizeObject(level));
        } else {
          batch = batch.set(this.levelsDb.doc(level.id.toString()), AppUtils.sanitizeObject(level));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.levels.splice(0);
          return resolve(saved.length === levels.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasLevels() {
    return this.levels.length > 0;
  }

  getLevelsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Level[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasLevels()) {
          console.log(`\n------------using existing ${this.levels.length} levels---------------\n`);
          // return resolve(this.levels);
        }
        let queryFn = this.levelsDb.orderBy("created");
        if (options.passmarkOperator) {
          queryFn = this.levelsDb.orderBy("passmark");
        }
        const set = new Set<FirestoreQuery>();
        if (AppUtils.stringIsSet(options.alias)) {
          set.add({ key: "alias", operator: "==", value: options.alias });
        }
        if (options.passmark !== undefined) {
          const operator = options.passmarkOperator || "==";
          set.add({ key: "passmark", operator, value: options.passmark });
        }
        if (AppUtils.stringIsSet(options.grading_id)) {
          set.add({ key: "grading_id", operator: "==", value: options.grading_id });
        }
        if (AppUtils.stringIsSet(options.teacher_id)) {
          set.add({ key: "teacher_id", operator: "==", value: options.teacher_id });
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
        let results: Level[] = snap.docs.map((doc) => {
          const level = new Level().toObject(doc.data());
          level.id = doc.id;
          return level;
        });
        if (!AppUtils.hasResponse(options)) {
          this.levels = results;
          console.log(`\n------------loaded ${this.levels.length} levels successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  addDefaultLevels() {
    return new Promise<boolean>((resolve, reject) => {
      const levels = [
        new Level(1, "P1"),
        new Level(2, "P2"),
        new Level(3, "P3"),
        new Level(4, "P4"),
        new Level(5, "P5"),
        new Level(6, "P6"),
        new Level(7, "P7")
      ];
      return this.saveLevels(levels).then((ok) => resolve(ok)).catch((reason) => reject(reason));
    });
  }

  getLevelByAlias(alias: string) {
    return new Promise<Level | null>((resolve, reject) => {
      return this.levelsDb.where("alias", "==", alias).get().then((snap) => {
        if (snap.empty) {
          return resolve(null);
        }
        const doc = snap.docs[0];
        const level = (new Level()).toObject(doc.data());
        level.id = doc.id;
        return resolve(level);
      }).catch((reason) => reject(reason));
    });
  }

  getGradingById(gradingId: any) {
    return new Promise<Grading | null>((resolve, reject) => {
      return this.gradingsDb.doc(gradingId.toString()).get().then((doc) => {
        if (!doc.exists) {
          return resolve(null);
        }
        const grading = (new Grading()).toObject(doc.data());
        grading.id = doc.id;
        return resolve(grading);
      }).catch((reason) => reject(reason));
    });
  }

  getTeacherById(teacherId: any) {
    return new Promise<Teacher | null>((resolve, reject) => {
      return this.teachersDb.doc(teacherId.toString()).get().then((doc) => {
        if (!doc.exists) {
          return resolve(null);
        }
        const teacher = (new Teacher()).toObject(doc.data());
        teacher.id = doc.id;
        return resolve(teacher);
      }).catch((reason) => reject(reason));
    });
  }

  getStreamById(streamId: any) {
    return new Promise<Stream | null>((resolve, reject) => {
      return this.streamsDb.doc(streamId.toString()).get().then((doc) => {
        if (!doc.exists) {
          return resolve(null);
        }
        const stream = (new Stream()).toObject(doc.data());
        stream.id = doc.id;
        return resolve(stream);
      }).catch((reason) => reject(reason));
    });
  }

  getSubjectById(subjectId: any) {
    return new Promise<Subject | null>((resolve, reject) => {
      return this.subjectsDb.doc(subjectId.toString()).get().then((doc) => {
        if (!doc.exists) {
          return resolve(null);
        }
        const subject = (new Subject()).toObject(doc.data());
        subject.id = doc.id;
        return resolve(subject);
      }).catch((reason) => reject(reason));
    });
  }

  getLevelsSubjectsByLevelId(levelId: any) {
    return new Promise<LevelsSubject[]>((resolve, reject) => {
      return this.levelsSubjectsDb.where("level_id", "==", levelId.toString()).get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const subjects = snap.docs.map((doc) => {
          const levelSubject = (new LevelsSubject()).toObject(doc.data());
          levelSubject.id = doc.id;
          return levelSubject;
        });
        return resolve(subjects);
      }).catch((reason) => reject(reason));
    });
  }

  getLevelsStreamsByLevelId(levelId: any) {
    return new Promise<LevelsStream[]>((resolve, reject) => {
      return this.levelsStreamsDb.where("level_id", "==", levelId.toString()).get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const streams = snap.docs.map((doc) => {
          const levelStream = (new LevelsStream()).toObject(doc.data());
          levelStream.id = doc.id;
          return levelStream;
        });
        return resolve(streams);
      }).catch((reason) => reject(reason));
    });
  }

  getEnrollmentsByLevelId(levelId: any) {
    return new Promise<Enrollment[]>((resolve, reject) => {
      return this.enrollmentsDb.where("level_id", "==", levelId.toString()).get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const enrollments = snap.docs.map((doc) => {
          const enrollment = (new Enrollment()).toObject(doc.data());
          enrollment.id = doc.id;
          return enrollment;
        });
        return resolve(enrollments);
      }).catch((reason) => reject(reason));
    });
  }
}

