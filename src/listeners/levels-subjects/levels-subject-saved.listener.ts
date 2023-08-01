import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { LevelsSubjectEvents, LevelsSubjectSavedEvent } from "../../events/levels-subjects";

@Injectable()
export class LevelsSubjectSavedListener {
  constructor() {
  }

  @OnEvent(LevelsSubjectEvents.SAVE)
  handleLevelsSubjectSavedEvent(event: LevelsSubjectSavedEvent) {
    if (event.updated) {
    }
  }
}