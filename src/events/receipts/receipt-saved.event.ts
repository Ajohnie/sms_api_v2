import { Receipt } from "../../lib";

export class ReceiptSavedEvent {
  receipt: Receipt;

  constructor(receipt: Receipt) {
    this.receipt = receipt;
  }
}