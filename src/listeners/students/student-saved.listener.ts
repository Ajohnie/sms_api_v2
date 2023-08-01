import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { StudentEvents, StudentSavedEvent } from "../../events/students";
import { EnrollmentsService } from "../../enrollements/enrollments.service";
import { Enrollment, Student, StudentStatus } from "../../lib";
import { LevelsStreamsService } from "../../levels-streams/levels-streams.service";
import { StudentsService } from "../../students/students.service";
import { PeriodsService } from "../../periods/periods.service";

@Injectable()
export class StudentSavedListener {
  constructor(private readonly service: EnrollmentsService,
              private readonly levelStreamsService: LevelsStreamsService,
              private readonly studentsService: StudentsService,
              private readonly periodsService: PeriodsService) {
  }

  @OnEvent(StudentEvents.SAVE)
  async handleStudentSavedEvent(event: StudentSavedEvent) {
    console.log("bg updating enrollment for student saved " + event.after.getName());
    // Get an object with the current entity value.
    // If the entity after does not exist, it has been deleted.
    const wasDeleted = event.deleted;
    const wasCreated = event.created;
    if (wasDeleted || wasCreated) {
      const entity = wasDeleted ? event.before : event.after;
      const objectBefore = new Student().toObject(entity);
      // update all corresponding enrollments
      try {
        const currentPeriod = await this.periodsService.getCurrentPeriod();
        if (!currentPeriod) {
          return true;
        }
        const levelStream = await this.levelStreamsService.getLevelsStreamById(objectBefore.levels_stream_id);
        if (!levelStream) {
          return true;
        }
        const enrollments = (await this.service.getEnrollmentsByOptions({
          period_Id: currentPeriod.id,
          level_id: levelStream.level_id
        }));
        const students = await this.studentsService.getStudentsByOptions({
          levels_stream_id: levelStream.id,
          status: StudentStatus.ACTIVE
        });
        const enrollment = enrollments[0] || new Enrollment();
        enrollment.period_id = currentPeriod.id;
        enrollment.level_id = levelStream.level_id;
        enrollment.no_of_students = students.length;
        return this.service.save(enrollment).then(() => {
          console.log(`updated enrollment successfully for level stream id ${objectBefore.levels_stream_id}`);
          return true;
        }).catch((reason) => console.error(reason));
      } catch (e) {
        console.error(e);
      }
    }
    // was updated
    if (event.updated) {
      return true; // do nothing
    }
  }
}