export class GradeDeletedEvent {
  gradeId: string;

  constructor(gradeId: string) {
    this.gradeId = gradeId;
  }
}