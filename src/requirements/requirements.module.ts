import { Module } from "@nestjs/common";
import { RequirementsService } from "./requirements.service";
import { RequirementsController } from "./requirements.controller";
import { RequirementDeletedListener, RequirementSavedListener } from "../listeners/requirements";
import { StudentsModule } from "../students/students.module";

@Module({
  controllers: [RequirementsController],
  imports: [StudentsModule],
  providers: [
    RequirementsService,
    RequirementSavedListener,
    RequirementDeletedListener],
  exports: [RequirementsService]
})
export class RequirementsModule {
}
