import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TermDeletedEvent, TermEvents } from "../../events/terms";

@Injectable()
export class TermDeletedListener {
  constructor() {
  }

  @OnEvent(TermEvents.DELETE)
  async handleTermDeletedEvent(event: TermDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}