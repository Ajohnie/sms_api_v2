import { Module } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";
import { SettingDeletedListener, SettingSavedListener } from "../listeners/settings";

@Module({
  controllers: [SettingsController],
  providers: [
    SettingsService,
    SettingSavedListener,
    SettingDeletedListener],
  exports: [SettingsService]
})
export class SettingsModule {
}
