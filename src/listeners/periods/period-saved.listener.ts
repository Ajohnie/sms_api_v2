import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PeriodEvents, PeriodSavedEvent } from "../../events/periods";
import { EnrollmentsService } from "../../enrollements/enrollments.service";
import { Enrollment, StudentStatus } from "../../lib";
import { StudentsService } from "../../students/students.service";
import { LevelsStreamsService } from "../../levels-streams/levels-streams.service";

@Injectable()
export class PeriodSavedListener {
  constructor(private readonly service: EnrollmentsService,
              private readonly levelStreamsService: LevelsStreamsService,
              private readonly studentsService: StudentsService) {
  }

  @OnEvent(PeriodEvents.SAVE)
  async handlePeriodSavedEvent(event: PeriodSavedEvent) {
    if (event.deleted) {
      // const objectBefore = new Period().toObject(entityBefore);
      // remove all corresponding enrollments
      try {
        const enrollments = (await this.service.getEnrollmentsByOptions({ period_Id: event.before.id }));
        if (enrollments.length > 0) {
          return this.service.deleteManyEnrollments(enrollments.map((en) => en.id))
            .then(() => {
              console.log(`updated enrollment successfully for period ${event.before.getDescription()} with id ${event.before.id}`);
              return true;
            })
            .catch((reason) => console.error(reason));
        }
        return true;
      } catch (e) {
        console.error(e);
      }
    }
    // entity was created
    if (event.created) {
      // const objectAfter = new Period().toObject(entityAfter);
      // create all corresponding enrollments
      try {
        const levelStreams = await this.levelStreamsService.getLevelsStreamsByOptions({}, true);
        const promises = [];
        for (const levelStream of levelStreams) {
          const students = await this.studentsService.getStudentsByOptions({
            levels_stream_id: levelStream.id,
            status: StudentStatus.ACTIVE
          });
          const enrollment = new Enrollment();
          enrollment.period_id = event.after.id;
          enrollment.level_id = levelStream.level_id;
          enrollment.no_of_students = students.length;
          promises.push(this.service.save(enrollment));
        }
        if (promises.length > 0) {
          return Promise.all(promises)
            .then(() => {
              console.log(`period ${event.after.getDescription()} has been created`);
              return true;
            })
            .catch((reason) => console.error(reason));
        }
        return true;
      } catch (e) {
        console.error(e);
      }
    }
    if (event.updated) {
      // const objectBefore = new Period().toObject(entityBefore);
      // const objectAfter = new Period().toObject(entityAfter);
      try {
        const enrollments = (await this.service.getEnrollmentsByOptions({ period_Id: event.after.id }));
        const levelStreams = await this.levelStreamsService.getLevelsStreamsByOptions({}, true);
        const promises = [];
        for (const levelStream of levelStreams) {
          const students = await this.studentsService.getStudentsByOptions({
            levels_stream_id: levelStream.id,
            status: StudentStatus.ACTIVE
          });
          const enrollment = enrollments.find((en) => {
            return en.level_id === levelStream.level_id && en.period_id === event.after.id;
          }) || new Enrollment();
          enrollment.period_id = event.after.id;
          enrollment.level_id = levelStream.level_id;
          enrollment.no_of_students = students.length;
          promises.push(this.service.save(enrollment));
        }
        if (promises.length > 0) {
          return Promise.all(promises)
            .then(() => {
              console.log(`period ${event.after.getDescription()} has been updated`);
              return true;
            })
            .catch((reason) => console.error(reason));
        }
        return true;
      } catch (e) {
        console.error(e);
      }
    }
  }
}