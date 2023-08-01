import { AppUtils, Student } from "../../lib";

export class StudentSavedEvent {
  after: Student;
  before: Student;
  updated: boolean;
  deleted: boolean;
  created: boolean;

  constructor(entityAfter: Student, entityBefore: Student) {
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