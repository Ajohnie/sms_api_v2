export class SubjectDeletedEvent {
  subjectId: string;

  constructor(subjectId: string) {
    this.subjectId = subjectId;
  }
}