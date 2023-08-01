export class ReceiptDeletedEvent {
  receiptId: string;

  constructor(receiptId: string) {
    this.receiptId = receiptId;
  }
}