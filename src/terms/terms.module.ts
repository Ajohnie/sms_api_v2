import { Module } from "@nestjs/common";
import { TermsService } from "./terms.service";
import { TermsController } from "./terms.controller";
import { TermDeletedListener } from "../listeners/terms";
import { SettingsModule } from "../settings/settings.module";

@Module({
  controllers: [TermsController],
  imports: [SettingsModule],
  providers: [
    TermsService,
    TermDeletedListener],
  exports: [TermsService]
})
export class TermsModule {
}
