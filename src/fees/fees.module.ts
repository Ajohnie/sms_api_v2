import { Module } from "@nestjs/common";
import { FeesService } from "./fees.service";
import { FeesController } from "./fees.controller";
import { FeeDeletedListener, FeeSavedListener } from "../listeners/fees";

@Module({
  controllers: [FeesController],
  imports: [],
  providers: [
    FeesService,
    FeeSavedListener,
    FeeDeletedListener],
  exports: [FeesService]
})
export class FeesModule {
}
