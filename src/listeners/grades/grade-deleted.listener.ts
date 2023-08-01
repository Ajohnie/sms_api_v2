import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { GradeDeletedEvent, GradeEvents } from "../../events/grades";

@Injectable()
export class GradeDeletedListener {
  constructor() {
  }

  @OnEvent(GradeEvents.DELETE)
  async handleGradeDeletedEvent(event: GradeDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}