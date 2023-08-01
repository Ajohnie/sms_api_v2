export class LevelsSubjectDeletedEvent {
  levelsStreamId: string;

  constructor(levelsStreamId: string) {
    this.levelsStreamId = levelsStreamId;
  }
}