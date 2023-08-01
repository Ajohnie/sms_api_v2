import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Requirement } from "../lib";
import { FireBase } from "../firebase";
import { RequirementDeletedEvent, RequirementEvents, RequirementSavedEvent } from "../events/requirements";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class RequirementsService {
  private requirementsDb = FireBase.getCollection(AppRoutes.requirements.api.INDEX);
  private requirements: Requirement[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  save(requirement: Requirement) {
    return new Promise<Requirement>(async (resolve, reject) => {
      try {
        await requirement.validate();
        const sanitized = AppUtils.sanitizeObject(requirement);
        if (AppUtils.stringIsSet(requirement.id)) {
          const entityBefore = await this.getRequirementById(requirement.id);
          requirement.setModified();
          return this.requirementsDb.doc(requirement.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Requirement()).toObject(requirement);
              const index = this.requirements.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.requirements[index] = savedBr;
              } else {
                this.requirements.push(savedBr);
              }
              this.eventEmitter.emit(RequirementEvents.SAVE, new RequirementSavedEvent(requirement, entityBefore));
              return resolve((new Requirement()).toObject(requirement));
            })
            .catch((error) => reject(error));
        }
        return this.requirementsDb.add(sanitized)
          .then((result) => {
            const newRequirement = (new Requirement()).toObject(requirement);
            newRequirement.id = result.id;
            this.requirements.push(newRequirement);
            this.eventEmitter.emit(RequirementEvents.SAVE, new RequirementSavedEvent(newRequirement, null));
            return resolve(newRequirement);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getRequirementById(id: string) {
    return new Promise<Requirement | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported requirement record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide requirement identifier");
        }
        const snapshot = await this.requirementsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const requirement = (new Requirement()).toObject(rawData);
          requirement.id = snapshot.id;
          return resolve(requirement);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyRequirements = (requirementIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (requirementIds.length === 0) {
        return reject("select requirements and try again");
      }
      let batch = this.requirementsDb.firestore.batch();
      requirementIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.requirementsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        requirementIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.requirements.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.requirements.splice(index, 1);
            }
            this.eventEmitter.emit(RequirementEvents.DELETE, new RequirementDeletedEvent(id));
          }
        });
        return resolve(result.length === requirementIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveRequirements(requirements: Requirement[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.requirementsDb.firestore.batch();
      for (const requirement of requirements) {
        requirement.setModified();
        if (!AppUtils.stringIsSet(requirement.id)) {
          batch = batch.create(this.requirementsDb.doc(), AppUtils.sanitizeObject(requirement));
        } else {
          batch = batch.set(this.requirementsDb.doc(requirement.id.toString()), AppUtils.sanitizeObject(requirement));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.requirements.splice(0);
          return resolve(saved.length === requirements.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasRequirements() {
    return this.requirements.length > 0;
  }

  getRequirementsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Requirement[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasRequirements()) {
          console.log(`\n------------using existing ${this.requirements.length} requirements---------------\n`);
          // return resolve(this.requirements);
        }
        let queryFn = this.requirementsDb.orderBy("created");
        const set = new Set<FirestoreQuery>();
        if (options.name !== undefined) {
          set.add({ key: "name", operator: "==", value: options.name });
        }
        if (options.description !== undefined) {
          set.add({ key: "description", operator: "==", value: options.description });
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
        let results: Requirement[] = snap.docs.map((doc) => {
          const requirement = new Requirement().toObject(doc.data());
          requirement.id = doc.id;
          return requirement;
        });
        if (!AppUtils.hasResponse(options)) {
          this.requirements = results;
          console.log(`\n------------loaded ${this.requirements.length} requirements successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  getRequirementByName(name: string) {
    return new Promise<Requirement | null>((resolve, reject) => {
      return this.requirementsDb.where("name", "==", name).get().then((snap) => {
        if (snap.empty) {
          return resolve(null);
        }
        const doc = snap.docs[0];
        const requirement = (new Requirement()).toObject(doc.data());
        requirement.id = doc.id;
        return resolve(requirement);
      }).catch((reason) => reject(reason));
    });
  }
}

