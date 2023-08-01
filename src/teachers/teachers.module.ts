import { Module } from "@nestjs/common";
import { TeachersService } from "./teachers.service";
import { TeachersController } from "./teachers.controller";
import { TeacherDeletedListener, TeacherSavedListener } from "../listeners/teachers";
import { LevelsSubjectsModule } from "../levels-subjects/levels-subjects.module";

@Module({
  controllers: [TeachersController],
  imports: [LevelsSubjectsModule],
  providers: [
    TeachersService,
    TeacherSavedListener,
    TeacherDeletedListener],
  exports: [TeachersService]
})
export class TeachersModule {
}
