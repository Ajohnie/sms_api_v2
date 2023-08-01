import { AppUtils, Level } from "../../lib";

export class LevelSavedEvent {
  after: Level;
  before: Level;
  updated: boolean;
  deleted: boolean;
  created: boolean;

  constructor(entityAfter: Level, entityBefore: Level) {
    this.after = entityAfter;
    this.before = entityBefore;
    // If the entity after does not exist, it has been deleted.
    this.deleted = !AppUtils.hasResponse(entityAfter) && AppUtils.hasResponse(entityBefore);
    // entity was created
    this.created = !AppUtils.hasResponse(entityBefore) && AppUtils.hasResponse(entityAfter);
    this.updated = AppUtils.hasResponse(entityBefore) && AppUtils.hasResponse(entityAfter);
  }
}