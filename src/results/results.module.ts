import { Module, OnModuleInit } from "@nestjs/common";
import { ResultsService } from "./results.service";
import { ResultsController } from "./results.controller";
import { ResultDeletedListener, ResultSavedListener } from "../listeners/results";
import { TermSavedListener } from "../listeners/terms";
import { ExamSavedListener } from "../listeners/exams";
import { SubjectSavedListener } from "../listeners/subjects";
import { AppCacheModule } from "../cache/app-cache.module";
import { LevelsModule } from "../levels/levels.module";
import { PeriodsModule } from "../periods/periods.module";
import { SubjectsModule } from "../subjects/subjects.module";
import { LevelsSubjectsModule } from "../levels-subjects/levels-subjects.module";
import { GradingsModule } from "../gradings/gradings.module";
import { TeachersModule } from "../teachers/teachers.module";
import { LevelsStreamsModule } from "../levels-streams/levels-streams.module";
import { StudentsModule } from "../students/students.module";
import { SettingsModule } from "../settings/settings.module";
import { RequirementsModule } from "../requirements/requirements.module";
import { FeesModule } from "../fees/fees.module";
import { ReceiptsModule } from "../receipts/receipts.module";
import { ExamsModule } from "../exams/exams.module";
import { TermsModule } from "../terms/terms.module";
import { EnrollmentsModule } from "../enrollements/enrollments.module";
import { ReportTemplatesModule } from "../reports/report-templates.module";

@Module({
  controllers: [ResultsController],
  imports: [
    AppCacheModule,
    LevelsModule,
    PeriodsModule,
    SubjectsModule,
    LevelsSubjectsModule,
    GradingsModule,
    TeachersModule,
    LevelsStreamsModule,
    StudentsModule,
    SettingsModule,
    RequirementsModule,
    FeesModule,
    ReceiptsModule,
    ExamsModule,
    TermsModule,
    EnrollmentsModule,
    ReportTemplatesModule
  ],
  providers: [
    ResultsService,
    TermSavedListener,
    ExamSavedListener,
    SubjectSavedListener,
    ResultSavedListener,
    ResultDeletedListener],
  exports: [ResultsService]
})
export class ResultsModule implements OnModuleInit {
  onModuleInit(): any {
    return new Promise<void>(resolve => {
      return resolve();
    });
  }
}
