import { Module } from "@nestjs/common";
import { PeriodsService } from "./periods.service";
import { PeriodsController } from "./periods.controller";
import { PeriodDeletedListener } from "../listeners/periods";

@Module({
  controllers: [PeriodsController],
  providers: [
    PeriodsService,
    PeriodDeletedListener],
  exports: [PeriodsService]
})
export class PeriodsModule {
}
