import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { GuardiansService } from "./guardians.service";
import { AppUtils, Guardian } from "../lib";
import { Converter } from "../converter";

@Controller("guardians")
export class GuardiansController {
  constructor(private readonly service: GuardiansService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.guardian;
        if (!obj) {
          return reject("Please set guardian and try again !");
        }
        const guardian = new Guardian().toObject(obj);
        return this.service.save(guardian)
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
        const guardians = await this.service.getGuardiansByOptions(options || {});
        return resolve(guardians);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("guardianId") guardianId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(guardianId)) {
          return reject("select guardian and try again");
        }
        const guardian = await this.service.getGuardianById(guardianId);
        if (!guardian) {
          return reject("Guardian not found or was removed !");
        }
        const students = await this.service.getStudentsByGuardianId(guardianId);
        if (students.length > 0) {
          return reject(`${guardian.getName()} is linked to fees payments`);
        }
        return this.service.deleteManyGuardians([guardianId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
