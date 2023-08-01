import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { GradingEvents, GradingSavedEvent } from "../../events/gradings";
import { GradesService } from "../../grades/grades.service";
import { LevelsService } from "../../levels/levels.service";

@Injectable()
export class GradingSavedListener {
  constructor(private readonly gradesService: GradesService,
              private readonly levelsService: LevelsService) {
  }

  @OnEvent(GradingEvents.SAVE)
  async handleGradingSavedEvent(event: GradingSavedEvent) {
    if (event.deleted) {
      // const objectBefore = new Grading().toObject(entityBefore);
      // remove all corresponding grades
      try {
        const grades = (await this.gradesService.getGradesByOptions({ grading_id: event.before.id }));
        const gradesAndLevels: Promise<any>[] = [];
        if (grades.length > 0) {
          gradesAndLevels.push(this.gradesService.deleteManyGrades(grades.map((grd) => grd.id)));
        }
        const levels = await this.levelsService.getLevelsByOptions({ grading_id: event.before.id });
        if (levels.length > 0) {
          const levelPromises = levels.map((lv) => {
            lv.grading_id = null;
            return this.levelsService.save(lv);
          });
          gradesAndLevels.push(...levelPromises);
        }
        return Promise.all(gradesAndLevels).then(() => true).catch((reason) => console.log(reason));
      } catch (e) {
        console.error(e);
      }
    } else if (event.created) {
      // create all corresponding grades
      try {
        event.after.setGrades();
        const allPromises: Promise<any>[] = [];
        const promises = event.after.getGrades().map((grd) => {
          grd.grading_id = event.after.id;
          return this.gradesService.save(grd);
        });
        allPromises.push(...promises);
        for (const alias of event.after.levels) {
          const level = (await this.levelsService.getLevelsByOptions({ alias }))[0];
          if (level) {
            level.grading_id = event.after.id;
            allPromises.push(this.levelsService.save(level));
          }
        }
        if (allPromises.length > 0) {
          return Promise.all(allPromises)
            .then(() => true)
            .catch((reason) => console.error(reason));
        }
        return true;
      } catch (e) {
        console.error(e);
      }
    } else if (event.updated) {
      try {
        const levelsBefore = event.before.levels;
        const levelsAfter = event.after.levels;
        const newAliases = levelsAfter.filter((alias1) => {
          const index = levelsBefore.findIndex((alias2) => alias2 === alias1);
          return index < 0;
        });
        const allPromises: Promise<any>[] = [];
        for (const alias of newAliases) {
          const level = (await this.levelsService.getLevelsByOptions({ alias }))[0];
          if (level) {
            level.grading_id = event.after.id;
            allPromises.push(this.levelsService.save(level));
          }
        }
      /*  const oldGrades = (await this.gradesService.getGradesByOptions({ grading_id: event.after.id }));
        const gradesToRemove = [];
        event.after.setGrades();
        const grades = event.after.getGrades();
        for (let grade of oldGrades) {
          const existing = grades.find((grd) => grd.code === grade.code);
          if (existing) {
            event.after.setGrade(grade);
          }
        }
        gradesToRemove.push(oldGrades.map((grd) => grd.id));
        if (gradesToRemove.length > 0) {
          allPromises.push(this.gradesService.deleteManyGrades(gradesToRemove));
        }
        const newGradePromises = grades.map((grd) => {
          grd.grading_id = event.after.id;
          return this.gradesService.save(grd);
        });
        allPromises.push(...newGradePromises);*/
        return Promise.all(allPromises)
          .then(() => true)
          .catch((reason) => console.error(reason));
      } catch (e) {
        console.error(e);
      }
    }
  }
}