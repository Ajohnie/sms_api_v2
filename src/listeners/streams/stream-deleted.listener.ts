import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { StreamDeletedEvent, StreamEvents } from "../../events/streams";

@Injectable()
export class StreamDeletedListener {
  constructor() {
  }

  @OnEvent(StreamEvents.DELETE)
  async handleStreamDeletedEvent(event: StreamDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}