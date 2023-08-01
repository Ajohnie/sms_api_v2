export * from "./transaction-saved.event";
export * from "./transaction-deleted.event";

export enum TransactionEvents {
  "SAVE" = "transaction.saved",
  "DELETE" = "transaction.deleted"
}