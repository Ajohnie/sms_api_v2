import { AppUtils, Period } from "../../lib";

export class PeriodSavedEvent {
  after: Period;
  before: Period;
  updated: boolean;
  deleted: boolean;
  created: boolean;

  constructor(entityAfter: Period, entityBefore: Period) {
    this.after = entityAfter;
    this.before = entityBefore;
    // If the entity after does not exist, it has been deleted.
    this.deleted = !AppUtils.hasResponse(entityAfter) && AppUtils.hasResponse(entityBefore);
    // entity was created
    this.created = !AppUtils.hasResponse(entityBefore) && AppUtils.hasResponse(entityAfter);
    // was updated
    this.updated = AppUtils.hasResponse(entityBefore) && AppUtils.hasResponse(entityAfter);
  }
}