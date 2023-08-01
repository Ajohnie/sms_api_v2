import { AppUtils, Requirement } from "../../lib";

export class RequirementSavedEvent {
  after: Requirement;
  before: Requirement;
  updated: boolean;
  deleted: boolean;
  created: boolean;

  constructor(entityAfter: Requirement, entityBefore: Requirement) {
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