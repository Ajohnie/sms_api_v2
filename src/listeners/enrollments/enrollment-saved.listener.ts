import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EnrollmentEvents, EnrollmentSavedEvent } from "../../events/enrollments";

@Injectable()
export class EnrollmentSavedListener {
  constructor() {
  }

  @OnEvent(EnrollmentEvents.SAVE)
  handleEnrollmentSavedEvent(event: EnrollmentSavedEvent) {
  }
}