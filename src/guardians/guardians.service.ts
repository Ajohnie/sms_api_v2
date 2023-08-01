import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Guardian, Student } from "../lib";
import { FireBase } from "../firebase";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { GuardianDeletedEvent, GuardianEvents, GuardianSavedEvent } from "../events/guardians";

@Injectable()
export class GuardiansService {
  private guardiansDb = FireBase.getCollection(AppRoutes.guardians.api.INDEX);
  private studentsDb = FireBase.getCollection(AppRoutes.students.api.INDEX);
  private guardians: Guardian[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  getStudentsByGuardianId(guardian_id: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Student[]>(async (resolve, reject) => {
      try {
        const snap = await this.studentsDb.where("guardian_id", "==", guardian_id.toString()).get();
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

  save(guardian: Guardian) {
    return new Promise<Guardian>(async (resolve, reject) => {
      try {
        await guardian.validate();
        const sanitized = AppUtils.sanitizeObject(guardian);
        if (AppUtils.stringIsSet(guardian.id)) {
          const entityBefore = await this.getGuardianById(guardian.id);
          guardian.setModified();
          return this.guardiansDb.doc(guardian.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Guardian()).toObject(guardian);
              const index = this.guardians.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.guardians[index] = savedBr;
              } else {
                this.guardians.push(savedBr);
              }
              this.eventEmitter.emit(GuardianEvents.SAVE, new GuardianSavedEvent(guardian, entityBefore));
              return resolve((new Guardian()).toObject(guardian));
            })
            .catch((error) => reject(error));
        }
        return this.guardiansDb.add(sanitized)
          .then((result) => {
            const newGuardian = (new Guardian()).toObject(guardian);
            newGuardian.id = result.id;
            this.guardians.push(newGuardian);
            this.eventEmitter.emit(GuardianEvents.SAVE, new GuardianSavedEvent(newGuardian, null));
            return resolve(newGuardian);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getGuardianById(id: string, skipChildren = false) {
    return new Promise<Guardian | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported guardian record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide guardian identifier");
        }
        const snapshot = await this.guardiansDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const guardian = (new Guardian()).toObject(rawData);
          guardian.id = snapshot.id;
          if (!skipChildren) {
            guardian.children = (await this.getStudentsByGuardianId(guardian.id))
              .map((st) => st.getNameAndLevel()).join(",");
          }
          return resolve(guardian);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyGuardians = (guardianIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (guardianIds.length === 0) {
        return reject("select guardians and try again");
      }
      let batch = this.guardiansDb.firestore.batch();
      guardianIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.guardiansDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        guardianIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.guardians.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.guardians.splice(index, 1);
            }
            this.eventEmitter.emit(GuardianEvents.DELETE, new GuardianDeletedEvent(id));
          }
        });
        return resolve(result.length === guardianIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveGuardians(guardians: Guardian[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.guardiansDb.firestore.batch();
      for (const guardian of guardians) {
        guardian.setModified();
        if (!AppUtils.stringIsSet(guardian.id)) {
          batch = batch.create(this.guardiansDb.doc(), AppUtils.sanitizeObject(guardian));
        } else {
          batch = batch.set(this.guardiansDb.doc(guardian.id.toString()), AppUtils.sanitizeObject(guardian));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.guardians.splice(0);
          return resolve(saved.length === guardians.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasGuardians() {
    return this.guardians.length > 0;
  }

  getGuardiansByOptions(options: any = {}, skipChildren = false) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Guardian[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasGuardians()) {
          console.log(`\n------------using existing ${this.guardians.length} guardians---------------\n`);
          // return resolve(this.guardians);
        }
        if (AppUtils.stringIsSet(options.guardian_id)) {
          return this.getGuardianById(options.guardian_id).then((res) => {
            if (!res) {
              return resolve([]);
            }
            return resolve([res]);
          });
        }
        const dateFieldName = options.dateOfBirth ? "dateOfBirth" : "created";
        let queryFn = this.guardiansDb.orderBy(dateFieldName);
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
        if (options.email !== undefined) {
          set.add({ key: "email", operator: "==", value: options.email });
        }
        if (options.address !== undefined) {
          set.add({ key: "address", operator: "==", value: options.address });
        }
        if (options.phoneNo !== undefined) {
          set.add({ key: "phoneNo", operator: "==", value: options.phoneNo });
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
        const snap = await queryFn.get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Guardian[] = snap.docs.map((doc) => {
          const guardian = new Guardian().toObject(doc.data());
          guardian.id = doc.id;
          return guardian;
        });
        if (!skipChildren) {
          for (const result of results) {
            result.children = (await this.getStudentsByGuardianId(result.id))
              .map((st) => st.getNameAndLevel()).join(",");
          }
        }
        if (!AppUtils.hasResponse(options)) {
          this.guardians = results;
          console.log(`\n------------loaded ${this.guardians.length} guardians successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }
}

