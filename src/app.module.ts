import { Module, OnModuleInit } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { EmailsModule } from "./emails/emails.module";
import { TermsModule } from "./terms/terms.module";
import { AuthModule } from "./auth/auth.module";
import { SharedModule } from "./shared/shared.module";
import { PeriodsModule } from "./periods/periods.module";
import { SettingsModule } from "./settings/settings.module";
import { ResultsModule } from "./results/results.module";
import { ExamsModule } from "./exams/exams.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { ReceiptsModule } from "./receipts/receipts.module";
import { FeesModule } from "./fees/fees.module";
import { GuardiansModule } from "./guardians/guardians.module";
import { LevelsModule } from "./levels/levels.module";
import { LevelsStreamsModule } from "./levels-streams/levels-streams.module";
import { LevelsSubjectsModule } from "./levels-subjects/levels-subjects.module";
import { StudentsModule } from "./students/students.module";
import { SubjectsModule } from "./subjects/subjects.module";
import { TeachersModule } from "./teachers/teachers.module";
import { GradesModule } from "./grades/grades.module";
import { GradingsModule } from "./gradings/gradings.module";
import { EnrollmentsModule } from "./enrollements/enrollments.module";
import { RequirementsModule } from "./requirements/requirements.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AppCacheModule } from "./cache/app-cache.module";
import { ReportTemplatesModule } from "./reports/report-templates.module";

@Module({
  imports: [
    AnalyticsModule,
    AuthModule,
    AppCacheModule,
    EmailsModule,
    EnrollmentsModule,
    ExamsModule,
    FeesModule,
    GradesModule,
    GradingsModule,
    GuardiansModule,
    LevelsModule,
    LevelsStreamsModule,
    LevelsSubjectsModule,
    PeriodsModule,
    ReceiptsModule,
    RequirementsModule,
    ResultsModule,
    SettingsModule,
    SharedModule,
    StudentsModule,
    SubjectsModule,
    TeachersModule,
    TermsModule,
    TransactionsModule,
    UsersModule,
    ReportTemplatesModule,
    EventEmitterModule.forRoot({
      // set this to `true` to use wildcards
      wildcard: false,
      // the delimiter used to segment namespaces
      delimiter: ".",
      // set this to `true` if you want to emit the newListener event
      newListener: false,
      // set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // the maximum amount of listeners that can be assigned to an event
      maxListeners: 10,
      // show event name in memory leak message when more than maximum amount of listeners is assigned
      verboseMemoryLeak: false,
      // disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false
    })
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements OnModuleInit {
  constructor() {
  }

  onModuleInit(): Promise<any> {
    return this.setUpAccounts();
  }


  setUpAccounts() {
    return new Promise<boolean>((resolve) => {
      return resolve(true);
    });
  }
}
