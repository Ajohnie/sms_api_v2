import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { LevelDeletedEvent, LevelEvents } from "../../events/levels";

@Injectable()
export class LevelsStreamDeletedListener {
  constructor() {
  }

  @OnEvent(LevelEvents.DELETE)
  async handleLevelDeletedEvent(event: LevelDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}