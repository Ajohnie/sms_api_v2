export class StudentDeletedEvent {
  studentId: string;

  constructor(studentId: string) {
    this.studentId = studentId;
  }
}