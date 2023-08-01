import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { EnrollmentsService } from "./enrollments.service";
import { AppUtils, Enrollment } from "../lib";
import { Converter } from "../converter";

@Controller("enrollments")
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.enrollment;
        if (!obj) {
          return reject("Please set enrollment and try again !");
        }
        const enrollment = new Enrollment().toObject(obj);
        return this.service.save(enrollment)
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
        const enrollments = await this.service.getEnrollmentsByOptions(options || {}, false);
        return resolve(enrollments);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("enrollmentId") enrollmentId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(enrollmentId)) {
          return reject("select enrollment and try again");
        }
        const enrollment = await this.service.getEnrollmentById(enrollmentId);
        if (!enrollment) {
          return reject("Enrollment not found or was removed !");
        }
        return this.service.deleteManyEnrollments([enrollmentId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
