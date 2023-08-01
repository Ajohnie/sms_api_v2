import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { GradeEvents, GradeSavedEvent } from "../../events/grades";

@Injectable()
export class GradeSavedListener {
  constructor() {
  }

  @OnEvent(GradeEvents.SAVE)
  handleGradeSavedEvent(event: GradeSavedEvent) {
  }
}