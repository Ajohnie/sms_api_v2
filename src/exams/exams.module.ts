import { Module } from "@nestjs/common";
import { ExamsService } from "./exams.service";
import { ExamsController } from "./exams.controller";
import { ExamDeletedListener } from "../listeners/exams";
import { SettingsModule } from "../settings/settings.module";

@Module({
  controllers: [ExamsController],
  imports: [SettingsModule],
  providers: [
    ExamsService,
    ExamDeletedListener],
  exports: [ExamsService]
})
export class ExamsModule {
}
