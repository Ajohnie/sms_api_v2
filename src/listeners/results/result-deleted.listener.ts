import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ResultDeletedEvent, ResultEvents } from "../../events/results";

@Injectable()
export class ResultDeletedListener {
  constructor() {
  }

  @OnEvent(ResultEvents.DELETE)
  async handleResultDeletedEvent(event: ResultDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}