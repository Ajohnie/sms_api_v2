import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { ExamsService } from "./exams.service";
import { AppUtils, Exam } from "../lib";
import { Converter } from "../converter";
import { SettingsService } from "../settings/settings.service";

@Controller("exams")
export class ExamsController {
  constructor(private readonly service: ExamsService,
              private readonly settingsService: SettingsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.exam;
        if (!obj) {
          return reject("Please set exam and try again !");
        }
        const exam = new Exam().toObject(obj);
        const otherExams = (await this.service.getExamsByOptions({}));
        const settings = await this.settingsService.getSettings();
        if (otherExams.length >= settings.maximumExamsPerTerm) {
          return reject(`You can not exceed the maximum number of exams per term(${settings.maximumExamsPerTerm})`);
        }
        const existingNo = otherExams.find((ex) => ex.value === exam.value);
        if (existingNo && existingNo.id !== exam.id) {
          return reject(`Exam No is already taken by ${existingNo.name}`);
        }
        const existingName = otherExams.find((ex) => ex.name === exam.name);
        if (existingName && existingName.id !== exam.id) {
          return reject(`Exam Name is already taken by Exam No ${existingName.value}`);
        }
        const existingAlias = otherExams.find((ex) => ex.alias === exam.alias);
        if (existingAlias && existingAlias.id !== exam.id) {
          return reject(`Exam Alias is already taken by Exam No ${existingAlias.value}`);
        }
        return this.service.save(exam)
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
        let exams = await this.service.getExamsByOptions(options || {});
        const create = options?.create?.toString() === "true" || true;
        if (exams.length === 0 && create) {
          await this.service.addDefaultExams();
          exams = await this.service.getExamsByOptions(options || {});
        }
        return resolve(exams);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("examId") examId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(examId)) {
          return reject("select exam and try again");
        }
        const exam = await this.service.getExamById(examId);
        if (!exam) {
          return reject("Exam not found or was removed !");
        }
        const periods = await this.service.getPeriodsByExamId(examId);
        if (periods.length > 0) {
          return reject(`${exam.name} is linked to periods`);
        }
        return this.service.deleteManyExams([examId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
