import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Teacher } from "../lib";
import { FireBase } from "../firebase";
import { TeacherDeletedEvent, TeacherEvents, TeacherSavedEvent } from "../events/teachers";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { LevelsSubjectsService } from "../levels-subjects/levels-subjects.service";

@Injectable()
export class TeachersService {
  private teachersDb = FireBase.getCollection(AppRoutes.teachers.api.INDEX);
  private teachers: Teacher[] = [];

  constructor(private eventEmitter: EventEmitter2,
              private readonly levelSubjectService: LevelsSubjectsService) {
  }

  save(teacher: Teacher) {
    return new Promise<Teacher>(async (resolve, reject) => {
      try {
        await teacher.validate();
        const sanitized = AppUtils.sanitizeObject(teacher);
        if (AppUtils.stringIsSet(teacher.id)) {
          const entityBefore = await this.getTeacherById(teacher.id);
          teacher.setModified();
          return this.teachersDb.doc(teacher.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Teacher()).toObject(teacher);
              /*const index = this.teachers.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.teachers[index] = savedBr;
              } else {
                this.teachers.push(savedBr);
              }*/
              this.teachers.splice(0);
              this.eventEmitter.emit(TeacherEvents.SAVE, new TeacherSavedEvent(teacher, entityBefore));
              return resolve((new Teacher()).toObject(teacher));
            })
            .catch((error) => reject(error));
        }
        return this.teachersDb.add(sanitized)
          .then((result) => {
            const newTeacher = (new Teacher()).toObject(teacher);
            newTeacher.id = result.id;
            this.teachers.push(newTeacher);
            this.eventEmitter.emit(TeacherEvents.SAVE, new TeacherSavedEvent(newTeacher, null));
            return resolve(newTeacher);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getTeacherById(id: string, skipExtras = false) {
    return new Promise<Teacher | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported teacher record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide teacher identifier");
        }
        const snapshot = await this.teachersDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const teacher = (new Teacher()).toObject(rawData);
          teacher.id = snapshot.id;
          if (!skipExtras) {
            const levelsMap = new Map<string, string[]>();
            for (const levelsSubjectId of teacher.levels_subjects) {
              const levels_subject = (await this.levelSubjectService.getLevelsSubjectById(levelsSubjectId));
              if (levels_subject) {
                const alias = levels_subject.level.alias;
                const list = levelsMap.get(alias) || [];
                list.push(levels_subject.subject.alias);
                levelsMap.set(alias, list);
              }
            }
            const aliases: string[] = [];
            levelsMap.forEach((subjects, alias) => {
              aliases.push(`${alias}(${subjects.join(",")})`);
            });
            teacher.levelsSubjectNames = aliases.join(",");
          }
          return resolve(teacher);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyTeachers = (teacherIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (teacherIds.length === 0) {
        return reject("select teachers and try again");
      }
      let batch = this.teachersDb.firestore.batch();
      teacherIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.teachersDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        teacherIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.teachers.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.teachers.splice(index, 1);
            }
            this.eventEmitter.emit(TeacherEvents.DELETE, new TeacherDeletedEvent(id));
          }
        });
        return resolve(result.length === teacherIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveTeachers(teachers: Teacher[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.teachersDb.firestore.batch();
      for (const teacher of teachers) {
        teacher.setModified();
        if (!AppUtils.stringIsSet(teacher.id)) {
          batch = batch.create(this.teachersDb.doc(), AppUtils.sanitizeObject(teacher));
        } else {
          batch = batch.set(this.teachersDb.doc(teacher.id.toString()), AppUtils.sanitizeObject(teacher));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.teachers.splice(0);
          return resolve(saved.length === teachers.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasTeachers() {
    return this.teachers.length > 0;
  }

  getTeachersByOptions(options: any = {}, skipExtras = false) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Teacher[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasTeachers()) {
          console.log(`\n------------using existing ${this.teachers.length} teachers---------------\n`);
          // return resolve(this.teachers);
        }
        const dateFieldName = "created";
        let queryFn = this.teachersDb.orderBy(dateFieldName);
        const set = new Set<FirestoreQuery>();
        if (options.fname !== undefined) {
          set.add({ key: "fname", operator: "==", value: options.fname });
        }
        if (options.lname !== undefined) {
          set.add({ key: "lname", operator: "==", value: options.lname });
        }
        if (options.otherNames !== undefined) {
          set.add({ key: "otherNames", operator: "==", value: options.otherNames });
        }
        if (options.initials !== undefined) {
          set.add({ key: "initials", operator: "==", value: options.initials });
        }
        if (options.role !== undefined) {
          set.add({ key: "role", operator: "==", value: options.role });
        }
        if (options.email !== undefined) {
          set.add({ key: "email", operator: "==", value: options.email });
        }
        if (options.address !== undefined) {
          set.add({ key: "address", operator: "==", value: options.address });
        }
        if (options.phone_no !== undefined) {
          set.add({ key: "phone_no", operator: "==", value: options.phone_no });
        }
        if (options.modifiedBy !== undefined) {
          set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
        }
        if (options.date !== undefined) {
          const operator = options.dateOperator || "==";
          set.add({ key: dateFieldName, operator, value: AppUtils.getShortDate(options.date) });
        }
        queryFn = FireBase.getQueryReference(queryFn, set);
        if (options.startDate && options.endDate) {
          queryFn = FireBase.getEntitiesByDateRange(queryFn,
            options.startDate,
            options.endDate,
            true, dateFieldName);
        }
        if (options.level_alias !== undefined) {
          queryFn = queryFn.where("levels", "array-contains", options.level_alias);
        }
        if (options.levels_subject_id !== undefined) {
          queryFn = queryFn.where("levels_subjects", "array-contains", options.levels_subject_id);
        }
        const snap = await queryFn.get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Teacher[] = snap.docs.map((doc) => {
          const teacher = new Teacher().toObject(doc.data());
          teacher.id = doc.id;
          return teacher;
        });
        if (!skipExtras) {
          for (const teacher of results) {
            const levelsMap = new Map<string, string[]>();
            const promises = teacher.levels_subjects
              .filter((lvs_id) => AppUtils.stringIsSet(lvs_id))
              .map((levelsSubjectId) => {
                return this.levelSubjectService.getLevelsSubjectById(levelsSubjectId, false);
              });
            const level_subjects = await Promise.all(promises);
            const actualLevelSubjects = level_subjects.filter((lvs) => lvs !== null);
            actualLevelSubjects.forEach((ls) => {
              if (ls) {
                const alias = ls.level.alias;
                const list = levelsMap.get(alias) || [];
                list.push(ls.subject.alias);
                levelsMap.set(alias, list);
              }
            });
            const aliases: string[] = [];
            levelsMap.forEach((subjects, alias) => {
              aliases.push(`${alias}(${subjects.join(",")})`);
            });
            teacher.levelsSubjectNames = aliases.join(",");
          }
        }
        if (!AppUtils.hasResponse(options)) {
          this.teachers = results;
          console.log(`\n------------loaded ${this.teachers.length} teachers successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }
}

