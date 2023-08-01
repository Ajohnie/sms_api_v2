import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { LevelsService } from "./levels.service";
import { AppUtils, Comments, Level } from "../lib";
import { Converter } from "../converter";

@Controller("levels")
export class LevelsController {
  constructor(private readonly service: LevelsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.level;
        if (!obj) {
          return reject("Please set level and try again !");
        }
        const level = new Level().toObject(obj);
        const existingAlias = await this.service.getLevelByAlias(level.alias);
        if (existingAlias && existingAlias.id !== level.id) {
          return reject(`Level Alias is already taken by ${existingAlias.alias}`);
        }
        if (AppUtils.stringIsSet(level.grading_id)) {
          const grading = await this.service.getGradingById(level.grading_id);
          if (grading) {
            const inComments = AppUtils.enumToArray(Comments).includes(grading.category);
            if (inComments) {
              return reject(`Grading ${grading?.category} is a comment and can not be used`);
            }
          } else {
            return reject(`The Grading you selected doesn\'t exist`);
          }
        }
        return this.service.save(level)
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
        let levels = await this.service.getLevelsByOptions(options || {});
        const create = options?.create?.toString() === "true" || true;
        if (levels.length === 0 && create) {
          await this.service.addDefaultLevels();
          levels = await this.service.getLevelsByOptions(options || {});
        }
        const skipChildren = options?.skipChildren?.toString() === "true";
        if (!skipChildren) {
          for (const level of levels) {
            if (AppUtils.stringIsSet(level.teacher_id)) {
              const teacher = (await this.service.getTeacherById(level.teacher_id));
              level.teacherName = teacher?.getName() || "";
            }
            if (AppUtils.stringIsSet(level.grading_id)) {
              const grading = await this.service.getGradingById(level.grading_id);
              level.gradingCategory = grading?.category || "";
            }
            const streamPromises = level.streams.map((id) => this.service.getStreamById(id));
            level.streamNames = (await Promise.all(streamPromises))
              .filter((stream) => stream !== null)
              .map((stream) => stream?.name || "")
              .join(",");
            const subjectPromises = level.subjects.map((id) => this.service.getSubjectById(id));
            level.subjectNames = (await Promise.all(subjectPromises))
              .filter((subject) => subject !== null)
              .map((subject) => subject?.name || "")
              .join(",");
          }
        }
        return resolve(levels);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("levelId") levelId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(levelId)) {
          return reject("select level and try again");
        }
        const level = await this.service.getLevelById(levelId);
        if (!level) {
          return reject("Level not found or was removed !");
        }
        const levelStreams = await this.service.getLevelsStreamsByLevelId(levelId);
        if (levelStreams.length > 0) {
          return reject(`${level.alias} is linked to streams`);
        }
        const levelSubjects = await this.service.getLevelsSubjectsByLevelId(levelId);
        if (levelSubjects.length > 0) {
          return reject(`${level.alias} is linked to subjects`);
        }
        const enrollments = (await this.service.getEnrollmentsByLevelId(levelId))
          .filter((en) => en.no_of_students > 0);
        if (enrollments.length > 0) {
          return reject(`${level.getName()} is linked to enrollments`);
        }
        return this.service.deleteManyLevels([levelId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
