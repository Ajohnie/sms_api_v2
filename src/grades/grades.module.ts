import { Module } from "@nestjs/common";
import { GradesService } from "./grades.service";
import { GradesController } from "./grades.controller";
import { GradeDeletedListener, GradeSavedListener } from "../listeners/grades";

@Module({
  controllers: [GradesController],
  imports: [],
  providers: [
    GradesService,
    GradeSavedListener,
    GradeDeletedListener],
  exports: [GradesService]
})
export class GradesModule {
}
