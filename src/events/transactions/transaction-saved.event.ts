import { Transaction } from "../../lib";

export class TransactionSavedEvent {
  transaction: Transaction;

  constructor(transaction: Transaction) {
    this.transaction = transaction;
  }
}