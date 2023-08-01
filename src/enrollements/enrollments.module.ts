import { Module } from "@nestjs/common";
import { EnrollmentsService } from "./enrollments.service";
import { EnrollmentsController } from "./enrollments.controller";
import { EnrollmentDeletedListener } from "../listeners/enrollments";
import { PeriodSavedListener } from "../listeners/periods";
import { StudentSavedListener } from "../listeners/students";
import { LevelsStreamsModule } from "../levels-streams/levels-streams.module";
import { StudentsModule } from "../students/students.module";
import { PeriodsModule } from "../periods/periods.module";

@Module({
  controllers: [EnrollmentsController],
  imports: [LevelsStreamsModule, StudentsModule, PeriodsModule],
  providers: [
    EnrollmentsService,
    PeriodSavedListener,
    StudentSavedListener,
    EnrollmentDeletedListener],
  exports: [EnrollmentsService]
})
export class EnrollmentsModule {
}
