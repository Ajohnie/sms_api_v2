import { AppUtils, Subject } from "../../lib";

export class SubjectSavedEvent {
  after: Subject;
  before: Subject;
  updated: boolean;

  constructor(entityAfter: Subject, entityBefore: Subject) {
    this.after = entityAfter;
    this.before = entityBefore;
    // If the entity after does not exist, it has been deleted.
    const wasDeleted = !AppUtils.hasResponse(entityAfter) && AppUtils.hasResponse(entityBefore);
    // entity was created
    const wasCreated = !AppUtils.hasResponse(entityBefore) && AppUtils.hasResponse(entityAfter);
    if (wasCreated || wasDeleted) {
      // do nothing -->attachments are checked before deleting
    }
    // was updated
    this.updated = AppUtils.hasResponse(entityBefore) && AppUtils.hasResponse(entityAfter);
  }
}