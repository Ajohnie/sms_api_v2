import { Module } from "@nestjs/common";
import { LevelsStreamsController } from "./levels-streams.controller";
import { LevelsModule } from "../levels/levels.module";
import { StreamsModule } from "../streams/streams.module";
import { LevelsStreamsService } from "./levels-streams.service";
import { LevelsStreamDeletedListener, LevelsStreamSavedListener } from "../listeners/levels-streams";

@Module({
  controllers: [LevelsStreamsController],
  imports: [LevelsModule, StreamsModule],
  providers: [
    LevelsStreamsService,
    LevelsStreamSavedListener,
    LevelsStreamDeletedListener],
  exports: [LevelsStreamsService]
})
export class LevelsStreamsModule {
}
