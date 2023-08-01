export class EnrollmentDeletedEvent {
  enrollmentId: string;

  constructor(enrollmentId: string) {
    this.enrollmentId = enrollmentId;
  }
}