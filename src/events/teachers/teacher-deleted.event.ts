export class TeacherDeletedEvent {
  teacherId: string;

  constructor(teacherId: string) {
    this.teacherId = teacherId;
  }
}