import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { AppUtils, LevelsSubject, Subject } from "../lib";
import { Converter } from "../converter";
import { LevelsSubjectsService } from "./levels-subjects.service";

@Controller("levels-subjects")
export class LevelsSubjectsController {
  constructor(private readonly service: LevelsSubjectsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.levelsSubject;
        if (!obj) {
          return reject("Please set level and try again !");
        }
        const levelSubject = new LevelsSubject().toObject(obj);
        const existingNo = (await this.service.getLevelsSubjectsByOptions(
          {
            level_id: levelSubject.level_id,
            subject_id: levelSubject.subject_id
          }))[0];
        if (existingNo && existingNo.id !== levelSubject.id) {
          return reject(`Levels subject is already taken by ${existingNo.getName()}`);
        }
        return this.service.save(levelSubject)
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
        let levelsSubjects = await this.service.getLevelsSubjectsByOptions(options || {});
        const create = options?.create?.toString() === "true" || true;
        if (levelsSubjects.length === 0 && create) {
          await this.service.addDefaultLevelSubjects();
          levelsSubjects = await this.service.getLevelsSubjectsByOptions(options || {});
        }
        return resolve(levelsSubjects);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("levelsSubjectId") levelsSubjectId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(levelsSubjectId)) {
          return reject("select subject and try again");
        }
        const levelsSubject = await this.service.getLevelsSubjectById(levelsSubjectId, false);
        if (!levelsSubject) {
          return reject("subject not found or was removed !");
        }
        // check for results
        const results = await this.service.getResultsByLevelId(levelsSubject.level_id);
        const subjectMap = results.map((result) => result.getSubjects());
        const subjects = AppUtils.reduceToObjects<Subject>(subjectMap);
        const subjectFound = subjects.find((subject) => subject.alias === levelsSubject.subject.alias);
        if (subjectFound) {
          return reject(`subject ${subjectFound.alias} has results in ${levelsSubject.level.alias}`);
        }
        return this.service.deleteManyLevelsSubjects([levelsSubjectId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
