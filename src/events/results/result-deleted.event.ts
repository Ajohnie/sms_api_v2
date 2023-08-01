export class ResultDeletedEvent {
  resultId: string;

  constructor(resultId: string) {
    this.resultId = resultId;
  }
}