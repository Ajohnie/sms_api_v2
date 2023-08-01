import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { PeriodsModule } from "../periods/periods.module";
import { EnrollmentsModule } from "../enrollements/enrollments.module";
import { LevelsModule } from "../levels/levels.module";
import { SubjectsModule } from "../subjects/subjects.module";

@Module({
  controllers: [AnalyticsController],
  imports: [
    PeriodsModule,
    EnrollmentsModule,
    LevelsModule,
    SubjectsModule
  ],
  providers: [],
  exports: []
})
export class AnalyticsModule {
}
