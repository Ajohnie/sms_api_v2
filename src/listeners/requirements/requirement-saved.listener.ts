import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RequirementEvents, RequirementSavedEvent } from "../../events/requirements";
import { StudentsService } from "../../students/students.service";

@Injectable()
export class RequirementSavedListener {
  constructor(private readonly service: StudentsService) {
  }

  @OnEvent(RequirementEvents.SAVE)
  async handleRequirementSavedEvent(event: RequirementSavedEvent) {
    // Get an object with the current entity value.
    // If the entity after does not exist, it has been deleted.
    const wasDeleted = event.deleted;
    if (wasDeleted) {
      // const objectBefore = new Grading().toObject(entityBefore);
      // remove all corresponding grades
      try {
        const students = await this.service.getStudentsByOptions({ requirement_id: event.before.id });
        if (students.length > 0) {
          const studentPromises = students.map((lv) => {
            lv.requirement_id = null;
            return this.service.save(lv);
          });
          return Promise.all(studentPromises).then(() => true).catch((reason) => console.log(reason));
        }
        return true;
      } catch (e) {
        console.error(e);
      }
    }
    // entity was created
    const wasCreated = event.created;
    // was updated
    const wasUpdated = event.updated;
    if (wasCreated || wasUpdated) {
      return true; // do nothing
    }
    return true;
  }
}