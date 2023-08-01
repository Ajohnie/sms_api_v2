import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Level, LevelsStream, Stream, Student } from "../lib";
import { FireBase } from "../firebase";
import { LevelEvents } from "../events/levels";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { LevelsService } from "../levels/levels.service";
import { StreamsService } from "../streams/streams.service";
import { LevelsStreamDeletedEvent, LevelsStreamSavedEvent } from "../events/levels-streams";

@Injectable()
export class LevelsStreamsService {
  private levelsStreamDb = FireBase.getCollection(AppRoutes.levels_streams.api.INDEX);
  private studentsDb = FireBase.getCollection(AppRoutes.students.api.INDEX);
  private levelsStreams: LevelsStream[] = [];

  constructor(private eventEmitter: EventEmitter2,
              private readonly levelsService: LevelsService,
              private readonly streamsService: StreamsService) {
  }

  getStudentsByLevelStreamId(levels_stream_id: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Student[]>(async (resolve, reject) => {
      try {
        const snap = await this.studentsDb.where("levels_stream_id", "==", levels_stream_id.toString()).get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Student[] = snap.docs.map((doc) => {
          const student = new Student().toObject(doc.data());
          student.id = doc.id;
          return student;
        });
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  save(levelsStream: LevelsStream) {
    return new Promise<LevelsStream>(async (resolve, reject) => {
      try {
        await levelsStream.validate();
        const sanitized = AppUtils.sanitizeObject(levelsStream);
        sanitized.level = null;
        sanitized.stream = null;
        if (AppUtils.stringIsSet(levelsStream.id)) {
          const entityBefore = await this.getLevelsStreamById(levelsStream.id, true);
          levelsStream.setModified();
          return this.levelsStreamDb.doc(levelsStream.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new LevelsStream()).toObject(levelsStream);
              const index = this.levelsStreams.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.levelsStreams[index] = savedBr;
              } else {
                this.levelsStreams.push(savedBr);
              }
              this.eventEmitter.emit(LevelEvents.SAVE, new LevelsStreamSavedEvent(levelsStream, entityBefore));
              return resolve((new LevelsStream()).toObject(levelsStream));
            })
            .catch((error) => reject(error));
        }
        return this.levelsStreamDb.add(sanitized)
          .then((result) => {
            const newLevelStream = (new LevelsStream()).toObject(levelsStream);
            newLevelStream.id = result.id;
            this.levelsStreams.push(newLevelStream);
            this.eventEmitter.emit(LevelEvents.SAVE, new LevelsStreamSavedEvent(newLevelStream, null));
            return resolve(newLevelStream);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getLevelsStreamById(id: string, skipChildren = false) {
    return new Promise<LevelsStream | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported level stream record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide level stream identifier");
        }
        const snapshot = await this.levelsStreamDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const levelsStream = (new LevelsStream()).toObject(rawData);
          levelsStream.id = snapshot.id;
          if (!skipChildren) {
            levelsStream.stream = (await this.streamsService.getStreamById(levelsStream.stream_id)) || new Stream();
            levelsStream.level = (await this.levelsService.getLevelById(levelsStream.level_id)) || new Level();
          }
          return resolve(levelsStream);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyLevelsStreams = (levelStreamIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (levelStreamIds.length === 0) {
        return reject("select streams and try again");
      }
      let batch = this.levelsStreamDb.firestore.batch();
      levelStreamIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.levelsStreamDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        levelStreamIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.levelsStreams.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.levelsStreams.splice(index, 1);
            }
            this.eventEmitter.emit(LevelEvents.DELETE, new LevelsStreamDeletedEvent(id));
          }
        });
        return resolve(result.length === levelStreamIds.length);
      }).catch((error) => reject(error));
    });
  };

  hasLevelsStreams() {
    return this.levelsStreams.length > 0;
  }

  getLevelsStreamsByOptions(options: any = {}, skipChildren = false) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<LevelsStream[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasLevelsStreams()) {
          console.log(`\n------------using existing ${this.levelsStreams.length} levels---------------\n`);
          // return resolve(this.levelsStreams);
        }
        let queryFn = this.levelsStreamDb.orderBy("created");
        const set = new Set<FirestoreQuery>();
        if (AppUtils.stringIsSet(options.level_id)) {
          set.add({ key: "level_id", operator: "==", value: options.level_id });
        }
        if (AppUtils.stringIsSet(options.stream_id)) {
          set.add({ key: "stream_id", operator: "==", value: options.stream_id });
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
        let results: LevelsStream[] = snap.docs.map((doc) => {
          const level = new LevelsStream().toObject(doc.data());
          level.id = doc.id;
          return level;
        });
        if (!AppUtils.hasResponse(options)) {
          this.levelsStreams = results;
          console.log(`\n------------loaded ${this.levelsStreams.length} levels streams successfully---------------\n`);
        }
        if (!skipChildren) {
          for (const levelStream of results) {
            levelStream.stream = (await this.streamsService.getStreamById(levelStream.stream_id)) || new Stream();
            levelStream.level = (await this.levelsService.getLevelById(levelStream.level_id)) || new Level();
          }
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  addDefaultLevelStreams() {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const levels = await this.levelsService.getLevelsByOptions();
        if (levels.length === 0) {
          await this.levelsService.addDefaultLevels();
          levels.push(...(await this.levelsService.getLevelsByOptions()));
        }
        const streams: Stream[] = await this.streamsService.getStreamsByOptions();
        if (streams.length === 0) {
          await this.streamsService.addDefaultStreams();
          streams.push(...(await this.streamsService.getStreamsByOptions()));
        }
        let batch = this.levelsStreamDb.firestore.batch();
        const levelsStreams: LevelsStream[] = [];
        for (const level of levels) {
          const lvs = streams.map((stream) => new LevelsStream(level.id, stream.id));
          levelsStreams.push(...lvs);
        }
        levelsStreams.forEach((levelsStream) => {
          const sanitized = AppUtils.sanitizeObject(levelsStream);
          sanitized.level = null;
          sanitized.stream = null;
          if (levelsStream.id) {
            batch = batch.set(this.levelsStreamDb.doc(levelsStream.id), sanitized);
          } else {
            batch = batch.create(this.levelsStreamDb.doc(), sanitized);
          }
        });
        return batch.commit().then((result) => {
          if (result.length === levelsStreams.length) {
            return resolve(true);
          }
          return reject("error creating levels streams");
        }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getLevelById(level_id) {
    return this.levelsService.getLevelById(level_id);
  }
}

