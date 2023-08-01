import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { TeachersService } from "./teachers.service";
import { AppUtils, Teacher } from "../lib";
import { Converter } from "../converter";

@Controller("teachers")
export class TeachersController {
  constructor(private readonly service: TeachersService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.teacher;
        if (!obj) {
          return reject("Please set teacher and try again !");
        }
        const teacher = new Teacher().toObject(obj);
        // check for duplicate emails and initials
        const duplicateInitials = (await this.service.getTeachersByOptions({ initials: teacher.initials }, true))[0];
        if (duplicateInitials && (duplicateInitials?.id !== teacher.id)) {
          return reject(`Initials ${teacher.initials} are already taken by ${duplicateInitials.getName()}`);
        }
        const duplicateEmail = (await this.service.getTeachersByOptions({ email: teacher.email }, true))[0];
        if (duplicateEmail && (duplicateEmail?.id !== teacher.id)) {
          return reject(`Email ${teacher.email} is already taken by ${duplicateEmail.getName()}`);
        }
        return this.service.save(teacher)
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
        const teachers = await this.service.getTeachersByOptions(options || {});
        return resolve(teachers);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("teacherId") teacherId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(teacherId)) {
          return reject("select teacher and try again");
        }
        const teacher = await this.service.getTeacherById(teacherId);
        if (!teacher) {
          return reject("Teacher not found or was removed !");
        }
        return this.service.deleteManyTeachers([teacherId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
