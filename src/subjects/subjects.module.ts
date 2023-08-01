import { Module } from "@nestjs/common";
import { SubjectsService } from "./subjects.service";
import { SubjectsController } from "./subjects.controller";
import { SubjectDeletedListener } from "../listeners/subjects";
import { SettingsModule } from "../settings/settings.module";

@Module({
  controllers: [SubjectsController],
  imports: [SettingsModule],
  providers: [
    SubjectsService,
    SubjectDeletedListener],
  exports: [SubjectsService]
})
export class SubjectsModule {
}
