import { Module } from "@nestjs/common";
import { GradingsService } from "./gradings.service";
import { GradingsController } from "./gradings.controller";
import { GradingDeletedListener, GradingSavedListener } from "../listeners/gradings";
import { GradesModule } from "../grades/grades.module";
import { LevelsModule } from "../levels/levels.module";

@Module({
  controllers: [GradingsController],
  imports: [GradesModule, LevelsModule],
  providers: [
    GradingsService,
    GradingSavedListener,
    GradingDeletedListener],
  exports: [GradingsService]
})
export class GradingsModule {
}
