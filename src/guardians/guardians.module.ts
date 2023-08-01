import { Module } from "@nestjs/common";
import { GuardiansService } from "./guardians.service";
import { GuardiansController } from "./guardians.controller";
import { GuardianDeletedListener, GuardianSavedListener } from "../listeners/guardians";

@Module({
  controllers: [GuardiansController],
  imports: [],
  providers: [
    GuardiansService,
    GuardianSavedListener,
    GuardianDeletedListener],
  exports: [GuardiansService]
})
export class GuardiansModule {
}
