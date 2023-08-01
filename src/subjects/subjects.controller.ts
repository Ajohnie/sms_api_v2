import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { SubjectsService } from "./subjects.service";
import { AppUtils, Subject } from "../lib";
import { Converter } from "../converter";
import { SettingsService } from "../settings/settings.service";

@Controller("subjects")
export class SubjectsController {
  constructor(private readonly service: SubjectsService,
              private readonly settingsService: SettingsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.subject;
        if (!obj) {
          return reject("Please set subject and try again !");
        }
        const subject = new Subject().toObject(obj);
        const otherSubjects = (await this.service.getSubjectsByOptions({}));
        const settings = await this.settingsService.getSettings();
        if (otherSubjects.length >= settings.maximumNumberOfSubjectsOffered) {
          return reject(`You can not exceed the maximum number of subjects per term(${settings.maximumNumberOfSubjectsOffered})`);
        }
        const existingName = otherSubjects.find((sub) => sub.name === subject.name);
        if (existingName && existingName.id !== subject.id) {
          return reject(`Subject Name is already taken by Subject ${existingName.name}`);
        }
        const existingAlias = otherSubjects.find((sub) => sub.alias === subject.alias);
        if (existingAlias && existingAlias.id !== subject.id) {
          return reject(`Subject Alias is already taken by Subject ${existingAlias.name}`);
        }
        return this.service.save(subject)
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
        let subjects = await this.service.getSubjectsByOptions(options || {});
        const create = options?.create?.toString() === "true" || true;
        if (subjects.length === 0 && create) {
          await this.service.addDefaultSubjects();
          subjects = await this.service.getSubjectsByOptions(options || {});
        }
        return resolve(subjects);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("subjectId") subjectId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(subjectId)) {
          return reject("select subject and try again");
        }
        const subject = await this.service.getSubjectById(subjectId);
        if (!subject) {
          return reject("Subject not found or was removed !");
        }
        const levelsSubjects = await this.service.getLevelsSubjectsBySubjectId(subjectId);
        if (levelsSubjects.length > 0) {
          return reject(`${subject.name} is linked to levels`);
        }
        return this.service.deleteManySubjects([subjectId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
