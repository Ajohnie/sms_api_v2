import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TransactionEvents, TransactionSavedEvent } from "../../events/transactions";

@Injectable()
export class TransactionSavedListener {
  @OnEvent(TransactionEvents.SAVE)
  handleTransactionSavedEvent(event: TransactionSavedEvent) {
  }
}