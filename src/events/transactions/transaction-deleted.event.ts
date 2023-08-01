export class TransactionDeletedEvent {
  transactionId: string;

  constructor(transactionId: string) {
    this.transactionId = transactionId;
  }
}