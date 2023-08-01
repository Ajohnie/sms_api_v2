import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Level, LevelsSubject, Result, Student, Subject } from "../lib";
import { FireBase } from "../firebase";
import { LevelEvents } from "../events/levels";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { LevelsService } from "../levels/levels.service";
import { SubjectsService } from "../subjects/subjects.service";
import { LevelsSubjectDeletedEvent, LevelsSubjectSavedEvent } from "../events/levels-subjects";

@Injectable()
export class LevelsSubjectsService {
  private levelsSubjectDb = FireBase.getCollection(AppRoutes.levels_subjects.api.INDEX);
  private resultsDb = FireBase.getCollection(AppRoutes.results.api.INDEX);
  private levelsSubjects: LevelsSubject[] = [];

  constructor(private eventEmitter: EventEmitter2,
              private readonly levelsService: LevelsService,
              private readonly subjectsService: SubjectsService) {
  }

  getResultsByLevelId(levelId: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Result[]>(async (resolve, reject) => {
      try {
        const snap = await this.resultsDb.where("level_id", "==", levelId.toString()).get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Result[] = snap.docs.map((doc) => {
          const result = new Result().toObject(doc.data());
          result.id = doc.id;
          return result;
        });
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  save(levelsSubject: LevelsSubject) {
    return new Promise<LevelsSubject>(async (resolve, reject) => {
      try {
        await levelsSubject.validate();
        const sanitized = AppUtils.sanitizeObject(levelsSubject);
        sanitized.level = null;
        sanitized.subject = null;
        if (AppUtils.stringIsSet(levelsSubject.id)) {
          const entityBefore = await this.getLevelsSubjectById(levelsSubject.id, true);
          levelsSubject.setModified();
          return this.levelsSubjectDb.doc(levelsSubject.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new LevelsSubject()).toObject(levelsSubject);
              const index = this.levelsSubjects.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.levelsSubjects[index] = savedBr;
              } else {
                this.levelsSubjects.push(savedBr);
              }
              this.eventEmitter.emit(LevelEvents.SAVE, new LevelsSubjectSavedEvent(levelsSubject, entityBefore));
              return resolve((new LevelsSubject()).toObject(levelsSubject));
            })
            .catch((error) => reject(error));
        }
        return this.levelsSubjectDb.add(sanitized)
          .then((result) => {
            const newLevelSubject = (new LevelsSubject()).toObject(levelsSubject);
            newLevelSubject.id = result.id;
            this.levelsSubjects.push(newLevelSubject);
            this.eventEmitter.emit(LevelEvents.SAVE, new LevelsSubjectSavedEvent(newLevelSubject, null));
            return resolve(newLevelSubject);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getLevelsSubjectById(id: string, skipChildren = false) {
    return new Promise<LevelsSubject | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported level subject record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide level subject identifier");
        }
        const snapshot = await this.levelsSubjectDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const levelsSubject = (new LevelsSubject()).toObject(rawData);
          levelsSubject.id = snapshot.id;
          if (!skipChildren) {
            levelsSubject.subject = (await this.subjectsService.getSubjectById(levelsSubject.subject_id)) || new Subject();
            levelsSubject.level = (await this.levelsService.getLevelById(levelsSubject.level_id)) || new Level();
          }
          return resolve(levelsSubject);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyLevelsSubjects = (levelSubjectIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (levelSubjectIds.length === 0) {
        return reject("select subjects and try again");
      }
      let batch = this.levelsSubjectDb.firestore.batch();
      levelSubjectIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.levelsSubjectDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        levelSubjectIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.levelsSubjects.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.levelsSubjects.splice(index, 1);
            }
            this.eventEmitter.emit(LevelEvents.DELETE, new LevelsSubjectDeletedEvent(id));
          }
        });
        return resolve(result.length === levelSubjectIds.length);
      }).catch((error) => reject(error));
    });
  };

  hasLevelsSubjects() {
    return this.levelsSubjects.length > 0;
  }

  getLevelsSubjectsByOptions(options: any = {}, skipChildren = false) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<LevelsSubject[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasLevelsSubjects()) {
          console.log(`\n------------using existing ${this.levelsSubjects.length} levels---------------\n`);
          // return resolve(this.levelsSubjects);
        }
        let queryFn = this.levelsSubjectDb.orderBy("created");
        const set = new Set<FirestoreQuery>();
        if (AppUtils.stringIsSet(options.level_id)) {
          set.add({ key: "level_id", operator: "==", value: options.level_id });
        }
        if (AppUtils.stringIsSet(options.subject_id)) {
          set.add({ key: "subject_id", operator: "==", value: options.subject_id });
        }
        if (AppUtils.stringIsSet(options.modifiedBy)) {
          set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
        }
        if (AppUtils.stringIsSet(options.date)) {
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
        let results: LevelsSubject[] = snap.docs.map((doc) => {
          const level = new LevelsSubject().toObject(doc.data());
          level.id = doc.id;
          return level;
        });
        if (!AppUtils.hasResponse(options)) {
          this.levelsSubjects = results;
          console.log(`\n------------loaded ${this.levelsSubjects.length} levels subjects successfully---------------\n`);
        }
        if (!skipChildren) {
          for (const levelSubject of results) {
            levelSubject.subject = (await this.subjectsService.getSubjectById(levelSubject.subject_id)) || new Subject();
            levelSubject.level = (await this.levelsService.getLevelById(levelSubject.level_id)) || new Level();
          }
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  addDefaultLevelSubjects() {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const levels = await this.levelsService.getLevelsByOptions();
        if (levels.length === 0) {
          await this.levelsService.addDefaultLevels();
          levels.push(...(await this.levelsService.getLevelsByOptions()));
        }
        const subjects: Subject[] = await this.subjectsService.getSubjectsByOptions();
        if (subjects.length === 0) {
          await this.subjectsService.addDefaultSubjects();
          subjects.push(...(await this.subjectsService.getSubjectsByOptions()));
        }
        let batch = this.levelsSubjectDb.firestore.batch();
        const levelsSubjects: LevelsSubject[] = [];
        for (const level of levels) {
          const lvs = subjects.map((subject) => new LevelsSubject(level.id, subject.id));
          levelsSubjects.push(...lvs);
        }
        levelsSubjects.forEach((levelsSubject) => {
          const sanitized = AppUtils.sanitizeObject(levelsSubject);
          sanitized.level = null;
          sanitized.subject = null;
          if (levelsSubject.id) {
            batch = batch.set(this.levelsSubjectDb.doc(levelsSubject.id), sanitized);
          } else {
            batch = batch.create(this.levelsSubjectDb.doc(), sanitized);
          }
        });
        return batch.commit().then((result) => {
          if (result.length === levelsSubjects.length) {
            return resolve(true);
          }
          return reject("error creating levels subjects");
        }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }
}

