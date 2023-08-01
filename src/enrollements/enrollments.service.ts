import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, Enrollment, FirestoreQuery, Level, Period } from "../lib";
import { FireBase } from "../firebase";
import { EnrollmentDeletedEvent, EnrollmentEvents, EnrollmentSavedEvent } from "../events/enrollments";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { LevelsStreamsService } from "../levels-streams/levels-streams.service";
import { PeriodsService } from "../periods/periods.service";

@Injectable()
export class EnrollmentsService {
  private enrollmentsDb = FireBase.getCollection(AppRoutes.enrollments.api.INDEX);
  private enrollments: Enrollment[] = [];

  constructor(private eventEmitter: EventEmitter2,
              private readonly levelsSteamsService: LevelsStreamsService,
              private readonly periodsService: PeriodsService) {
  }

  save(enrollment: Enrollment) {
    return new Promise<Enrollment>(async (resolve, reject) => {
      try {
        await enrollment.validate();
        const sanitized = AppUtils.sanitizeObject(enrollment);
        sanitized.level = null;
        sanitized.period = null;
        if (AppUtils.stringIsSet(enrollment.id)) {
          const entityBefore = await this.getEnrollmentById(enrollment.id);
          enrollment.setModified();
          return this.enrollmentsDb.doc(enrollment.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Enrollment()).toObject(enrollment);
              const index = this.enrollments.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.enrollments[index] = savedBr;
              } else {
                this.enrollments.push(savedBr);
              }
              this.eventEmitter.emit(EnrollmentEvents.SAVE, new EnrollmentSavedEvent(enrollment, entityBefore));
              return resolve((new Enrollment()).toObject(enrollment));
            })
            .catch((error) => reject(error));
        }
        return this.enrollmentsDb.add(sanitized)
          .then((result) => {
            const newEnrollment = (new Enrollment()).toObject(enrollment);
            newEnrollment.id = result.id;
            this.enrollments.push(newEnrollment);
            this.eventEmitter.emit(EnrollmentEvents.SAVE, new EnrollmentSavedEvent(newEnrollment, null));
            return resolve(newEnrollment);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getEnrollmentById(id: string) {
    return new Promise<Enrollment | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported enrollment record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide enrollment identifier");
        }
        const snapshot = await this.enrollmentsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const enrollment = (new Enrollment()).toObject(rawData);
          enrollment.id = snapshot.id;
          return resolve(enrollment);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyEnrollments = (enrollmentIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (enrollmentIds.length === 0) {
        return reject("select enrollments and try again");
      }
      let batch = this.enrollmentsDb.firestore.batch();
      enrollmentIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.enrollmentsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        enrollmentIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.enrollments.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.enrollments.splice(index, 1);
            }
            this.eventEmitter.emit(EnrollmentEvents.DELETE, new EnrollmentDeletedEvent(id));
          }
        });
        return resolve(result.length === enrollmentIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveEnrollments(enrollments: Enrollment[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.enrollmentsDb.firestore.batch();
      for (const enrollment of enrollments) {
        enrollment.setModified();
        enrollment.level = null;
        enrollment.period = null;
        if (!AppUtils.stringIsSet(enrollment.id)) {
          batch = batch.create(this.enrollmentsDb.doc(), AppUtils.sanitizeObject(enrollment));
        } else {
          batch = batch.set(this.enrollmentsDb.doc(enrollment.id.toString()), AppUtils.sanitizeObject(enrollment));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.enrollments.splice(0);
          return resolve(saved.length === enrollments.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasEnrollments() {
    return this.enrollments.length > 0;
  }

  getEnrollmentsByOptions(options: any = {}, skipChildren = true) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Enrollment[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasEnrollments()) {
          console.log(`\n------------using existing ${this.enrollments.length} enrollments---------------\n`);
          // return resolve(this.enrollments);
        }
        let queryFn = this.enrollmentsDb.orderBy("created");
        if (options.noOperator) {
          queryFn = this.enrollmentsDb.orderBy("no");
        }
        const set = new Set<FirestoreQuery>();
        if (options.no !== undefined) {
          const operator = options.noOperator || "==";
          set.add({ key: "no_of_students", operator, value: options.no });
        }
        if (options.period_id !== undefined) {
          set.add({ key: "period_id", operator: "==", value: options.period_id });
        }
        if (options.level_id !== undefined) {
          set.add({ key: "level_id", operator: "==", value: options.level_id });
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
        let results: Enrollment[] = snap.docs.map((doc) => {
          const enrollment = new Enrollment().toObject(doc.data());
          enrollment.id = doc.id;
          return enrollment;
        });
        if (!skipChildren) {
          for (const en of results) {
            en.period = (await this.periodsService.getPeriodById(en.period_id)) || new Period();
            en.level = (await this.levelsSteamsService.getLevelById(en.level_id)) || new Level();
          }
        }
        if (!AppUtils.hasResponse(options)) {
          this.enrollments = results;
          console.log(`\n------------loaded ${this.enrollments.length} enrollments successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }
}

