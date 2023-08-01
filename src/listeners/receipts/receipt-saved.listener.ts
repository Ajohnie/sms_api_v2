import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ReceiptEvents, ReceiptSavedEvent } from "../../events/receipts";

@Injectable()
export class ReceiptSavedListener {
  @OnEvent(ReceiptEvents.SAVE)
  handleReceiptSavedEvent(event: ReceiptSavedEvent) {
  }
}