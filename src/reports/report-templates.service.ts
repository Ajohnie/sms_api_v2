import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, ReportTemplate } from "../lib";
import { FireBase } from "../firebase";

@Injectable()
export class ReportTemplatesService {
  private reportsDb = FireBase.getCollection(AppRoutes.reportTemplates.api.INDEX);
  private reports: ReportTemplate[] = [];

  constructor() {
  }

  save(report: ReportTemplate) {
    return new Promise<ReportTemplate>(async (resolve, reject) => {
      try {
        await report.validate();
        const sanitized = AppUtils.sanitizeObject(report);
        if (AppUtils.stringIsSet(report.id)) {
          const entityBefore = await this.getReportById(report.id);
          report.setModified();
          return this.reportsDb.doc(report.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new ReportTemplate()).toObject(report);
              const index = this.reports.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.reports[index] = savedBr;
              } else {
                this.reports.push(savedBr);
              }
              return resolve((new ReportTemplate()).toObject(report));
            })
            .catch((error) => reject(error));
        }
        return this.reportsDb.add(sanitized)
          .then((result) => {
            const newReport = (new ReportTemplate()).toObject(report);
            newReport.id = result.id;
            this.reports.push(newReport);
            return resolve(newReport);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getReportById(id: string) {
    return new Promise<ReportTemplate | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported report record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide report identifier");
        }
        const snapshot = await this.reportsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const report = (new ReportTemplate()).toObject(rawData);
          report.id = snapshot.id;
          return resolve(report);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  deleteManyReports = (reportIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (reportIds.length === 0) {
        return reject("select reports and try again");
      }
      let batch = this.reportsDb.firestore.batch();
      reportIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.reportsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        reportIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.reports.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.reports.splice(index, 1);
            }
          }
        });
        return resolve(result.length === reportIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveReports(reports: ReportTemplate[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.reportsDb.firestore.batch();
      for (const report of reports) {
        report.setModified();
        if (!AppUtils.stringIsSet(report.id)) {
          batch = batch.create(this.reportsDb.doc(), AppUtils.sanitizeObject(report));
        } else {
          batch = batch.set(this.reportsDb.doc(report.id.toString()), AppUtils.sanitizeObject(report));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.reports.splice(0);
          return resolve(saved.length === reports.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasReports() {
    return this.reports.length > 0;
  }

  getReportsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<ReportTemplate[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasReports()) {
          console.log(`\n------------using existing ${this.reports.length} reports---------------\n`);
          // return resolve(this.reports);
        }
        let queryFn = this.reportsDb.orderBy("created");
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
        let results: ReportTemplate[] = snap.docs.map((doc) => {
          const report = new ReportTemplate().toObject(doc.data());
          report.id = doc.id;
          return report;
        });
        if (!AppUtils.hasResponse(options)) {
          this.reports = results;
          console.log(`\n------------loaded ${this.reports.length} reports successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  addDefaultReports() {
    return new Promise<boolean>((resolve, reject) => {
      const reports = [];
      return this.saveReports(reports).then((ok) => resolve(ok)).catch((reason) => reject(reason));
    });
  }

  getReportByName(name: string) {
    return new Promise<ReportTemplate | null>((resolve, reject) => {
      return this.reportsDb.where("name", "==", name).get().then((snap) => {
        if (snap.empty) {
          return resolve(null);
        }
        const doc = snap.docs[0];
        const report = (new ReportTemplate()).toObject(doc.data());
        report.id = doc.id;
        return resolve(report);
      }).catch((reason) => reject(reason));
    });
  }
}

