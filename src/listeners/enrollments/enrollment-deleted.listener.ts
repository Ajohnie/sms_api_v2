import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EnrollmentDeletedEvent, EnrollmentEvents } from "../../events/enrollments";

@Injectable()
export class EnrollmentDeletedListener {
  constructor() {
  }

  @OnEvent(EnrollmentEvents.DELETE)
  async handleEnrollmentDeletedEvent(event: EnrollmentDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}