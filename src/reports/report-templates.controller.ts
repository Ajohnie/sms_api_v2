import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { ReportTemplatesService } from "./report-templates.service";
import { AppUtils, ReportTemplate } from "../lib";
import { Converter } from "../converter";

@Controller("report-templates")
export class ReportTemplatesController {
  constructor(private readonly service: ReportTemplatesService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.report;
        if (!obj) {
          return reject("Please set report and try again !");
        }
        const report = new ReportTemplate().toObject(obj);
        const otherReports = (await this.service.getReportsByOptions({}));
        const existingName = otherReports.find((sub) => sub.name === report.name);
        if (existingName && existingName.id !== report.id) {
          return reject(`Report Name is already taken by Report ${existingName.name}`);
        }
        return this.service.save(report)
          .then((sup) => resolve(AppUtils.sanitizeObject(sup)))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        let reports = await this.service.getReportsByOptions(options || {});
        const create = options?.create?.toString() === "true" || true;
        if (reports.length === 0 && create) {
          await this.service.addDefaultReports();
          reports = await this.service.getReportsByOptions(options || {});
        }
        return resolve(reports);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("reportId") reportId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(reportId)) {
          return reject("select report and try again");
        }
        const report = await this.service.getReportById(reportId);
        if (!report) {
          return reject("Report not found or was removed !");
        }
        return this.service.deleteManyReports([reportId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
