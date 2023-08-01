import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, LevelsStream, Stream } from "../lib";
import { FireBase } from "../firebase";
import { StreamDeletedEvent, StreamEvents, StreamSavedEvent } from "../events/streams";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class StreamsService {
  private streamsDb = FireBase.getCollection(AppRoutes.streams.api.INDEX);
  private levelsStreamsDb = FireBase.getCollection(AppRoutes.levels_streams.api.INDEX);
  private streams: Stream[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  getLevelsStreamsByStreamId(streamId: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<LevelsStream[]>(async (resolve, reject) => {
      try {
        const snap = await this.levelsStreamsDb.where("stream_id", "==", streamId.toString()).get();
        if (snap.empty) {
          return resolve([]);
        }
        const results: LevelsStream[] = snap.docs.map((doc) => {
          const levelsStream = new LevelsStream().toObject(doc.data());
          levelsStream.id = doc.id;
          return levelsStream;
        });
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  save(stream: Stream) {
    return new Promise<Stream>((resolve, reject) => {
      return stream.validate().then(async () => {
        try {
          const sanitized = AppUtils.sanitizeObject(stream);
          if (AppUtils.stringIsSet(stream.id)) {
            const entityBefore = await this.getStreamById(stream.id);
            stream.setModified();
            return this.streamsDb.doc(stream.id.toString())
              .set(sanitized)
              .then(() => {
                const savedBr = (new Stream()).toObject(stream);
                const index = this.streams.findIndex((prd) => prd.id === savedBr.id);
                if (index > -1) {
                  this.streams[index] = savedBr;
                } else {
                  this.streams.push(savedBr);
                }
                this.eventEmitter.emit(StreamEvents.SAVE, new StreamSavedEvent(stream, entityBefore));
                return resolve((new Stream()).toObject(stream));
              })
              .catch((error) => reject(error));
          }
          return this.streamsDb.add(sanitized)
            .then((result) => {
              const newStream = (new Stream()).toObject(stream);
              newStream.id = result.id;
              this.streams.push(newStream);
              this.eventEmitter.emit(StreamEvents.SAVE, new StreamSavedEvent(newStream, null));
              return resolve(newStream);
            }).catch((error) => reject(error));
        } catch (e) {
          return reject(e);
        }
      }).catch((error) => reject(error));
    });
  }

  getStreamById(id: string) {
    return new Promise<Stream | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported stream record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide stream identifier");
        }
        const snapshot = await this.streamsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const stream = (new Stream()).toObject(rawData);
          stream.id = snapshot.id;
          return resolve(stream);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyStreams = (streamIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (streamIds.length === 0) {
        return reject("select streams and try again");
      }
      let batch = this.streamsDb.firestore.batch();
      streamIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.streamsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        streamIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.streams.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.streams.splice(index, 1);
            }
            this.eventEmitter.emit(StreamEvents.DELETE, new StreamDeletedEvent(id));
          }
        });
        return resolve(result.length === streamIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveStreams(streams: Stream[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.streamsDb.firestore.batch();
      for (const stream of streams) {
        stream.setModified();
        if (!AppUtils.stringIsSet(stream.id)) {
          batch = batch.create(this.streamsDb.doc(), AppUtils.sanitizeObject(stream));
        } else {
          batch = batch.set(this.streamsDb.doc(stream.id.toString()), AppUtils.sanitizeObject(stream));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.streams.splice(0);
          return resolve(saved.length === streams.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasStreams() {
    return this.streams.length > 0;
  }

  getStreamsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Stream[]>(async (resolve, reject) => {
      try {
        if (this.streams.length > 0 && !AppUtils.hasResponse(options)) {
          return resolve(this.streams);
        }
        let queryFn = this.streamsDb.orderBy("created");
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
        let results: Stream[] = snap.docs.map((doc) => {
          const stream = new Stream().toObject(doc.data());
          stream.id = doc.id;
          return stream;
        });
        if (!AppUtils.hasResponse(options)) {
          this.streams = results;
          console.log(`\n------------loaded ${this.streams.length} streams successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  addDefaultStreams() {
    return new Promise<boolean>((resolve, reject) => {
      return this.save(new Stream(null, "NONE"))
        .then((ok) => resolve(true))
        .catch((reason) => reject(reason));
    });
  }

  getStreamByName(name: string) {
    return new Promise<Stream | null>((resolve, reject) => {
      return this.streamsDb.where("name", "==", name).get().then((snap) => {
        if (snap.empty) {
          return resolve(null);
        }
        const doc = snap.docs[0];
        const stream = (new Stream()).toObject(doc.data());
        stream.id = doc.id;
        return resolve(stream);
      }).catch((reason) => reject(reason));
    });
  }
}

