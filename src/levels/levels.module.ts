import { Module } from "@nestjs/common";
import { LevelsService } from "./levels.service";
import { LevelsController } from "./levels.controller";
import { LevelDeletedListener, LevelSavedListener } from "../listeners/levels";

@Module({
  controllers: [LevelsController],
  imports: [],
  providers: [
    LevelsService,
    LevelSavedListener,
    LevelDeletedListener],
  exports: [LevelsService]
})
export class LevelsModule {
}
