export class PeriodDeletedEvent {
  periodId: string;

  constructor(periodId: string) {
    this.periodId = periodId;
  }
}