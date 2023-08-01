import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Setting } from "../lib";
import { FireBase } from "../firebase";
import { SettingDeletedEvent, SettingEvents, SettingSavedEvent } from "../events/settings";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class SettingsService {
  private settings: Setting[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  getSettings(databaseId?: any) {
    return new Promise<Setting>((resolve, reject) => {
      const dbId = AppUtils.stringIsSet(databaseId) ? databaseId : "";
      return this.settingsDb(dbId).get().then((snapshot) => {
        if (snapshot.docs.length > 0) {
          const rawData = snapshot.docs[0];
          const settings = (new Setting()).toObject(rawData.data());
          settings.id = rawData.id;
          return resolve(settings);
        }
        return resolve(new Setting());
      }).catch((error) => reject(error));
    });
  }

  save(setting: Setting) {
    return new Promise<Setting>(async (resolve, reject) => {
      try {
        await setting.validate();
        if (AppUtils.stringIsSet(setting.id)) {
          setting.setModified();
          return this.settingsDb().doc(setting.id.toString())
            .set(AppUtils.sanitizeObject(setting))
            .then(() => {
              const savedBr = (new Setting()).toObject(setting);
              const index = this.settings.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.settings[index] = savedBr;
              } else {
                this.settings.push(savedBr);
              }
              this.eventEmitter.emit(SettingEvents.SAVE, new SettingSavedEvent(setting));
              return resolve((new Setting()).toObject(setting));
            })
            .catch((error) => reject(error));
        }
        return this.settingsDb().add(AppUtils.sanitizeObject(setting))
          .then((result) => {
            const newSetting = (new Setting()).toObject(setting);
            newSetting.id = result.id;
            this.settings.push(newSetting);
            this.eventEmitter.emit(SettingEvents.SAVE, new SettingSavedEvent(newSetting));
            return resolve(newSetting);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getSettingById(id: string) {
    return new Promise<Setting | null>((resolve, reject) => {
      if (typeof id === "object") {
        return reject(`unsupported setting record identifier, contact admin`);
      }
      if (!AppUtils.stringIsSet(id)) {
        return reject("provide setting identifier");
      }
      return this.settingsDb().doc(id.toString()).get().then((snapshot) => {
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const setting = (new Setting()).toObject(rawData);
          setting.id = snapshot.id;
          return resolve(setting);
        }
        return resolve(null);
      }).catch((error) => reject(error));
    });
  }

  deleteManySettings = (settingIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (settingIds.length === 0) {
        return reject("select settings and try again");
      }
      let batch = this.settingsDb().firestore.batch();
      settingIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.settingsDb().doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        settingIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.settings.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.settings.splice(index, 1);
            }
            this.eventEmitter.emit(SettingEvents.DELETE, new SettingDeletedEvent(id));
          }
        });
        return resolve(result.length === settingIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveSettings(settings: Setting[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.settingsDb().firestore.batch();
      for (const setting of settings) {
        setting.setModified();
        if (!AppUtils.stringIsSet(setting.id)) {
          batch = batch.create(this.settingsDb().doc(), AppUtils.sanitizeObject(setting));
        } else {
          batch = batch.set(this.settingsDb().doc(setting.id.toString()), AppUtils.sanitizeObject(setting));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.settings.splice(0);
          return resolve(saved.length === settings.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasSettings() {
    return this.settings.length > 0;
  }

  getSettingsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Setting[]>((resolve, reject) => {
      if (!AppUtils.hasResponse(options) && this.hasSettings()) {
        console.log(`\n------------using existing ${this.settings.length} settings---------------\n`);
        // return resolve(this.settings);
      }
      let queryFn = this.settingsDb().orderBy("created");
      if (options.valueOperator) {
        queryFn = this.settingsDb().orderBy("value");
      }
      const set = new Set<FirestoreQuery>();
      if (options.name !== undefined) {
        set.add({ key: "school_name", operator: "==", value: options.name });
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
      return queryFn.get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const settings: Setting[] = snap.docs.map((doc) => {
          const setting = new Setting().toObject(doc.data());
          setting.id = doc.id;
          return setting;
        });
        if (!AppUtils.hasResponse(options)) {
          this.settings = settings;
          console.log(`\n------------loaded ${this.settings.length} settings successfully---------------\n`);
        }
        return resolve(settings);
      }).catch((reason) => reject(reason));
    });
  }

  private settingsDb = (databaseId?: any) => FireBase.getCollection(AppRoutes.settings.api.INDEX, databaseId);
}

