import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ReceiptDeletedEvent, ReceiptEvents } from "../../events/receipts";

@Injectable()
export class ReceiptDeletedListener {
  constructor() {
  }

  @OnEvent(ReceiptEvents.DELETE)
  async handleReceiptDeletedEvent(event: ReceiptDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}