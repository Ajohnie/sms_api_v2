import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { PeriodsService } from "./periods.service";
import { AppUtils, Period } from "../lib";
import { Converter } from "../converter";

@Controller("periods")
export class PeriodsController {
  constructor(private readonly service: PeriodsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>((resolve, reject) => {
      const bodyObj = Converter.fromBody(body);
      const obj = bodyObj.period;
      if (!obj) {
        return reject("Please set period and try again !");
      }
      const period = new Period().toObject(obj);
      return this.service.save(period)
        .then((sup) => resolve(AppUtils.sanitizeObject(sup)))
        .catch((reason) => reject(reason));
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>((resolve, reject) => {
      return this.service.getPeriodsByOptions(options || {})
        .then((periods) => {
          return resolve(periods);
        }).catch((reason) => reject(reason));
    });
  }

  @Delete("delete")
  remove(@Query("periodId") periodId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(periodId)) {
          return reject("select period and try again");
        }
        return this.service.deleteManyPeriods([periodId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
