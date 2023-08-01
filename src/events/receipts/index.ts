export * from "./receipt-saved.event";
export * from "./receipt-deleted.event";

export enum ReceiptEvents {
  "SAVE" = "receipt.saved",
  "DELETE" = "receipt.deleted"
}