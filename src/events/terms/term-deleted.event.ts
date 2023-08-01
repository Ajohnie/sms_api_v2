export class TermDeletedEvent {
  termId: string;

  constructor(termId: string) {
    this.termId = termId;
  }
}