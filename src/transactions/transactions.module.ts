import { Module } from "@nestjs/common";
import { TransactionsService } from "./transactions.service";
import { TransactionsController } from "./transactions.controller";
import { TransactionDeletedListener, TransactionSavedListener } from "../listeners/transactions";

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    TransactionSavedListener,
    TransactionDeletedListener
  ],
  exports: [TransactionsService]
})
export class TransactionsModule {
}
