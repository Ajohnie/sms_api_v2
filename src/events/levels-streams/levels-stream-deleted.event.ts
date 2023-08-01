export class LevelsStreamDeletedEvent {
  levelsStreamId: string;

  constructor(levelsStreamId: string) {
    this.levelsStreamId = levelsStreamId;
  }
}