import { Module } from "@nestjs/common";
import { ReceiptsService } from "./receipts.service";
import { ReceiptsController } from "./receipts.controller";
import { ReceiptDeletedListener, ReceiptSavedListener } from "../listeners/receipts";

@Module({
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    ReceiptSavedListener,
    ReceiptDeletedListener],
  exports: [ReceiptsService]
})
export class ReceiptsModule {
}
