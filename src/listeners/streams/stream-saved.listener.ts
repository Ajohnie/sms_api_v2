import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { StreamEvents, StreamSavedEvent } from "../../events/streams";

@Injectable()
export class StreamSavedListener {
  constructor() {
  }

  @OnEvent(StreamEvents.SAVE)
  handleStreamSavedEvent(event: StreamSavedEvent) {
    if (event.updated) {
    }
  }
}