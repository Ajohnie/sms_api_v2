export class LevelDeletedEvent {
  levelId: string;

  constructor(levelId: string) {
    this.levelId = levelId;
  }
}