import { Module } from "@nestjs/common";
import { LevelsSubjectsService } from "./levels-subjects.service";
import { LevelsSubjectDeletedListener, LevelsSubjectSavedListener } from "../listeners/levels-subjects";
import { LevelsSubjectsController } from "./levels-subjects.controller";
import { LevelsModule } from "../levels/levels.module";
import { SubjectsModule } from "../subjects/subjects.module";

@Module({
  controllers: [LevelsSubjectsController],
  imports: [LevelsModule, SubjectsModule],
  providers: [
    LevelsSubjectsService,
    LevelsSubjectSavedListener,
    LevelsSubjectDeletedListener],
  exports: [LevelsSubjectsService]
})
export class LevelsSubjectsModule {
}
