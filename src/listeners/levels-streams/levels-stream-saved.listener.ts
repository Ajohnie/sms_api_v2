import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { LevelsStreamEvents, LevelsStreamSavedEvent } from "../../events/levels-streams";

@Injectable()
export class LevelsStreamSavedListener {
  constructor() {
  }

  @OnEvent(LevelsStreamEvents.SAVE)
  handleLevelsStreamSavedEvent(event: LevelsStreamSavedEvent) {
    if (event.updated) {
    }
  }
}