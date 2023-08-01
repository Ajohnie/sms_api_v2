export class GuardianDeletedEvent {
  guardianId: string;

  constructor(guardianId: string) {
    this.guardianId = guardianId;
  }
}