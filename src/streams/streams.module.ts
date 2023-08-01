import { Module } from "@nestjs/common";
import { StreamsService } from "./streams.service";
import { StreamsController } from "./streams.controller";
import { StreamDeletedListener } from "../listeners/streams";
import { SettingsModule } from "../settings/settings.module";

@Module({
  controllers: [StreamsController],
  imports: [SettingsModule],
  providers: [
    StreamsService,
    StreamDeletedListener],
  exports: [StreamsService]
})
export class StreamsModule {
}
