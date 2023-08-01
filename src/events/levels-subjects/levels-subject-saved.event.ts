import { AppUtils, LevelsSubject } from "../../lib";

export class LevelsSubjectSavedEvent {
  after: LevelsSubject;
  before: LevelsSubject;
  updated: boolean;

  constructor(entityAfter: LevelsSubject, entityBefore: LevelsSubject) {
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