import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { LevelEvents, LevelSavedEvent } from "../../events/levels";
import { AppRoutes, AppUtils, Grading, LevelsStream, LevelsSubject, Teacher } from "../../lib";
import { LevelsService } from "../../levels/levels.service";
import { FireBase } from "../../firebase";


@Injectable()
export class LevelSavedListener {
  private gradingsDb = FireBase.getCollection(AppRoutes.gradings.api.INDEX);
  private teachersDb = FireBase.getCollection(AppRoutes.teachers.api.INDEX);
  private levelsStreamsDb = FireBase.getCollection(AppRoutes.levels_streams.api.INDEX);
  private levelsSubjectsDb = FireBase.getCollection(AppRoutes.levels_subjects.api.INDEX);

  constructor(private readonly service: LevelsService) {
  }

  @OnEvent(LevelEvents.SAVE)
  async handleLevelSavedEvent(event: LevelSavedEvent) {
    // update gradings, teachers, results, streams, subjects
    /*no need to update results since levelAlias is never used
    * when showing results, when creating them, it is updated*/
    // Get an object with the current entity value.

    // If the entity after does not exist, it has been deleted.

    // entity was created
    const level_id = event.after.id;
    if (event.created) {
      // create streams and subjects
      const promises: Promise<any>[] = [];
      const levelStreamsPromises = event.after.streams
        .filter((streamId) => AppUtils.stringIsSet(streamId))
        .map((stream_id) => {
          return this.saveLevelsStream(new LevelsStream(level_id, stream_id));
        });
      promises.push(...levelStreamsPromises);
      const levelSubjectsPromises = event.after.subjects
        .filter((subjectId) => AppUtils.stringIsSet(subjectId))
        .map((subject_id) => {
          return this.saveLevelsSubject(new LevelsSubject(level_id, subject_id));
        });
      // level subjects will need further adjustment on other fields in the UI
      promises.push(...levelSubjectsPromises);
      return Promise.all(promises)
        .then(() => true)
        .catch((reason) => {
          console.error(reason);
          return true;
        });
    }
    if (event.deleted) {
      return true; // do nothing -->attachments are checked before deleting
    }
    // was updated
    if (event.updated) {
      const promises: Promise<any>[] = [];
      const aliasChanged = event.after.alias !== event.before.alias;
      try {
        if (aliasChanged) {
          const gradings = (await this.getGradingsByLevelAlias(event.before.alias));
          const gradingPromises = gradings.map((grd) => {
            grd.setLevel(event.after.alias);
            return this.saveGrading(grd);
          });
          const teachers = (await this.getTeachersByLevelAlias(event.before.alias));
          const teacherPromises = teachers.map((teacher) => {
            teacher.setLevel(event.after.alias);
            return this.saveTeacher(teacher);
          });
          promises.push(...gradingPromises);
          promises.push(...teacherPromises);
        }
        // update streams and subjects -->do this from the web client
        const removedStreamIds = event.before.streams.filter((stream_id) => {
          const index = event.after.streams.findIndex((id) => id === stream_id);
          return index < 0;
        });
        const level_streams_ids: any[] = [];
        for (const removedStreamId of removedStreamIds) {
          const level_streams = (await this.getLevelsStreamsByOptions(removedStreamId, level_id))
            .map((lvs) => lvs.id);
          level_streams_ids.push(...level_streams);
        }
        if (level_streams_ids.length > 0) {
          promises.push(this.deleteManyLevelsStream(level_streams_ids));
        }
        const addedStreamIds = event.after.streams.filter((stream_id) => {
          const index = event.before.streams.findIndex((id) => id === stream_id);
          return index < 0;
        });
        for (const addStreamId of addedStreamIds) {
          const level_streams = (await this.getLevelsStreamsByOptions(addStreamId, level_id));
          if (level_streams.length === 0) {
            promises.push(this.saveLevelsStream(new LevelsStream(level_id, addStreamId)));
          }
        }
        // level subjects
        const removedSubjectIds = event.before.subjects.filter((subject_id) => {
          const index = event.after.subjects.findIndex((id) => id === subject_id);
          return index < 0;
        });
        const level_subjects_ids: any[] = [];
        for (const removedSubjectId of removedSubjectIds) {
          const level_subjects = (await this.getLevelsSubjectsByOptions(removedSubjectId, level_id))
            .map((lvs) => lvs.id);
          level_subjects_ids.push(...level_subjects);
        }
        if (level_subjects_ids.length > 0) {
          promises.push(this.deleteManyLevelsSubject(level_subjects_ids));
        }
        const addedSubjectIds = event.after.subjects.filter((subject_id) => {
          const index = event.before.subjects.findIndex((id) => id === subject_id);
          return index < 0;
        });
        for (const addSubjectId of addedSubjectIds) {
          const level_subjects = (await this.getLevelsSubjectsByOptions(addSubjectId, level_id));
          if (level_subjects.length === 0) {
            promises.push(this.saveLevelsSubject(new LevelsSubject(level_id, addSubjectId)));
          }
        }
        return Promise.all(promises)
          .then(() => true)
          .catch((reason) => console.error(reason));
      } catch (e) {
        console.error(e);
      }
    }
  }


  private deleteManyLevelsSubject(level_subjects_ids: any[]) {
    return new Promise<boolean>((resolve, reject) => {
      if (level_subjects_ids.length === 0) {
        return resolve(false);
      }
      let batch = this.levelsSubjectsDb.firestore.batch();
      level_subjects_ids.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.levelsSubjectsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        return resolve(result.length === level_subjects_ids.length);
      }).catch((error) => reject(error));
    });
  }

  private deleteManyLevelsStream(level_streams_ids: any[]) {
    return new Promise<boolean>((resolve, reject) => {
      if (level_streams_ids.length === 0) {
        return resolve(false);
      }
      let batch = this.levelsStreamsDb.firestore.batch();
      level_streams_ids.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.levelsStreamsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        return resolve(result.length === level_streams_ids.length);
      }).catch((error) => reject(error));
    });
  }

  private getLevelsSubjectsByOptions(subject_id: string, level_id: any) {
    return new Promise<LevelsSubject[]>((resolve, reject) => {
      return this.levelsSubjectsDb
        .where("level_id", "==", level_id.toString())
        .where("subject_id", "==", subject_id.toString())
        .get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const results: LevelsSubject[] = snap.docs.map((doc) => {
            const levelsSubject = new LevelsSubject().toObject(doc.data());
            levelsSubject.id = doc.id;
            return levelsSubject;
          });
          return resolve(results);
        }).catch((reason) => reject(reason));
    });
  }

  private getLevelsStreamsByOptions(stream_id: any, level_id: any) {
    return new Promise<LevelsStream[]>((resolve, reject) => {
      return this.levelsStreamsDb
        .where("level_id", "==", level_id.toString())
        .where("stream_id", "==", stream_id.toString())
        .get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const results: LevelsStream[] = snap.docs.map((doc) => {
            const levelsStream = new LevelsStream().toObject(doc.data());
            levelsStream.id = doc.id;
            return levelsStream;
          });
          return resolve(results);
        }).catch((reason) => reject(reason));
    });
  }

  private getTeachersByLevelAlias(level_alias: string) {
    return new Promise<Teacher[]>((resolve, reject) => {
      return this.teachersDb
        .where("levels", "array-contains", level_alias)
        .get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const results: Teacher[] = snap.docs.map((doc) => {
            const teacher = new Teacher().toObject(doc.data());
            teacher.id = doc.id;
            return teacher;
          });
          return resolve(results);
        }).catch((reason) => reject(reason));
    });
  }

  private getGradingsByLevelAlias(level_alias: string) {
    return new Promise<Grading[]>((resolve, reject) => {
      return this.gradingsDb
        .where("levels", "array-contains", level_alias)
        .get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const results: Grading[] = snap.docs.map((doc) => {
            const grading = new Grading().toObject(doc.data());
            grading.getGrades();
            grading.id = doc.id;
            return grading;
          });
          return resolve(results);
        }).catch((reason) => reject(reason));
    });
  }

  private saveLevelsStream(levelsStream: LevelsStream) {
    return new Promise<LevelsStream>(async (resolve, reject) => {
      try {
        await levelsStream.validate();
        const sanitized = AppUtils.sanitizeObject(levelsStream);
        if (AppUtils.stringIsSet(levelsStream.id)) {
          levelsStream.setModified();
          return this.levelsStreamsDb.doc(levelsStream.id.toString())
            .set(sanitized)
            .then(() => {
              return resolve((new LevelsStream()).toObject(levelsStream));
            })
            .catch((error) => reject(error));
        }
        return this.levelsStreamsDb.add(sanitized)
          .then((result) => {
            const newLevelsStream = (new LevelsStream()).toObject(levelsStream);
            newLevelsStream.id = result.id;
            return resolve(newLevelsStream);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  private saveLevelsSubject(levelsSubject: LevelsSubject) {
    return new Promise<LevelsSubject>(async (resolve, reject) => {
      try {
        await levelsSubject.validate();
        const sanitized = AppUtils.sanitizeObject(levelsSubject);
        if (AppUtils.stringIsSet(levelsSubject.id)) {
          levelsSubject.setModified();
          return this.levelsSubjectsDb.doc(levelsSubject.id.toString())
            .set(sanitized)
            .then(() => {
              return resolve((new LevelsSubject()).toObject(levelsSubject));
            })
            .catch((error) => reject(error));
        }
        return this.levelsSubjectsDb.add(sanitized)
          .then((result) => {
            const newLevelsSubject = (new LevelsSubject()).toObject(levelsSubject);
            newLevelsSubject.id = result.id;
            return resolve(newLevelsSubject);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  private saveTeacher(teacher) {
    return new Promise<Teacher>(async (resolve, reject) => {
      try {
        await teacher.validate();
        const sanitized = AppUtils.sanitizeObject(teacher);
        if (AppUtils.stringIsSet(teacher.id)) {
          teacher.setModified();
          return this.teachersDb.doc(teacher.id.toString())
            .set(sanitized)
            .then(() => {
              return resolve((new Teacher()).toObject(teacher));
            })
            .catch((error) => reject(error));
        }
        return this.teachersDb.add(sanitized)
          .then((result) => {
            const newTeacher = (new Teacher()).toObject(teacher);
            newTeacher.id = result.id;
            return resolve(newTeacher);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  private saveGrading(grading) {
    return new Promise<Grading>((resolve, reject) => {
      return grading.validate().then(async () => {
        try {
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
      }).catch((error) => reject(error));
    });
  }
}