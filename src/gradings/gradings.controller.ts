import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { GradingsService } from "./gradings.service";
import { AppUtils, Grading } from "../lib";
import { Converter } from "../converter";

@Controller("gradings")
export class GradingsController {
  constructor(private readonly service: GradingsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.grading;
        if (!obj) {
          return reject("Please set grading and try again !");
        }
        const grading = new Grading().toObject(obj);
        return this.service.save(grading)
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
        const gradings = await this.service.getGradingsByOptions(options || {});
        return resolve(gradings);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("gradingId") gradingId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(gradingId)) {
          return reject("select grading and try again");
        }
        const grading = await this.service.getGradingById(gradingId);
        if (!grading) {
          return reject("Grading not found or was removed !");
        }
        return this.service.deleteManyGradings([gradingId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
