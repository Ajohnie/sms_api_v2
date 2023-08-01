import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TeacherDeletedEvent, TeacherEvents } from "../../events/teachers";

@Injectable()
export class TeacherDeletedListener {
  constructor() {
  }

  @OnEvent(TeacherEvents.DELETE)
  async handleTeacherDeletedEvent(event: TeacherDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}