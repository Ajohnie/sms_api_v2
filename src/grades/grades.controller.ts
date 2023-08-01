import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { GradesService } from "./grades.service";
import { AppUtils, Grade } from "../lib";
import { Converter } from "../converter";

@Controller("grades")
export class GradesController {
  constructor(private readonly service: GradesService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.grade;
        if (!obj) {
          return reject("Please set grade and try again !");
        }
        const grade = new Grade().toObject(obj);
        const grading = await this.service.getGradingById(grade.grading_id);
        if (!grading) {
          return reject(`grading for ${grade.code} was not found or was deleted`);
        }
        grading.setGrade(grade); // saving grading will overwrite grades
        await this.service.saveGrading(grading);
        const grades = await this.service.getGradesByOptions({ grading_id: grade.grading_id, code: grade.code });
        if (grades.length > 1) {
          const idsToDelete = grades.map((grd) => grd.id);
          await this.service.deleteManyGrades(idsToDelete);
        } else if (grades.length === 1) {
          grade.id = grades[0].id;
        }
        return this.service.save(grade)
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
        const grades = await this.service.getGradesByOptions(options || {});
        return resolve(grades);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("gradeId") gradeId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(gradeId)) {
          return reject("select grade and try again");
        }
        const grade = await this.service.getGradeById(gradeId);
        if (!grade) {
          return reject("Grade not found or was removed !");
        }
        const grading = await this.service.getGradingById(grade.grading_id);
        if (grading) {
          return reject(`${grade.code} is linked to grading ${grading.category}`);
        }
        return this.service.deleteManyGrades([gradeId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
