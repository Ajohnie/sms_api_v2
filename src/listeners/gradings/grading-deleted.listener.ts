import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { GradingDeletedEvent, GradingEvents } from "../../events/gradings";
import { GradesService } from "../../grades/grades.service";
import { LevelsService } from "../../levels/levels.service";

@Injectable()
export class GradingDeletedListener {
  constructor(private readonly gradesService: GradesService,
              private readonly levelsService: LevelsService) {
  }

  @OnEvent(GradingEvents.DELETE)
  async handleGradingDeletedEvent(event: GradingDeletedEvent) {
    // const objectBefore = new Grading().toObject(entityBefore);
    // remove all corresponding grades
    try {
      const grades = (await this.gradesService.getGradesByOptions({ grading_id: event.gradingId }));
      const gradesAndLevels: Promise<any>[] = [];
      if (grades.length > 0) {
        gradesAndLevels.push(this.gradesService.deleteManyGrades(grades.map((grd) => grd.id)));
      }
      const levels = await this.levelsService.getLevelsByOptions({ grading_id: event.gradingId });
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
  }
}