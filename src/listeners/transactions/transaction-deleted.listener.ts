import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TransactionDeletedEvent, TransactionEvents } from "../../events/transactions";

@Injectable()
export class TransactionDeletedListener {
  constructor() {
  }

  @OnEvent(TransactionEvents.DELETE)
  async handleTransactionDeletedEvent(event: TransactionDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}