import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { StudentDeletedEvent, StudentEvents } from "../../events/students";

@Injectable()
export class StudentDeletedListener {
  constructor() {
  }

  @OnEvent(StudentEvents.DELETE)
  async handleStudentDeletedEvent(event: StudentDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}