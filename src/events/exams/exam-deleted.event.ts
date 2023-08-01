export class ExamDeletedEvent {
  examId: string;

  constructor(examId: string) {
    this.examId = examId;
  }
}