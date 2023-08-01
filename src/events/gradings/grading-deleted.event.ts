export class GradingDeletedEvent {
  gradingId: string;

  constructor(gradingId: string) {
    this.gradingId = gradingId;
  }
}