export class FeeDeletedEvent {
  feeId: string;

  constructor(feeId: string) {
    this.feeId = feeId;
  }
}