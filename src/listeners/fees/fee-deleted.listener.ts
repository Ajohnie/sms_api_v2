import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { FeeDeletedEvent, FeeEvents } from "../../events/fees";

@Injectable()
export class FeeDeletedListener {
  constructor() {
  }

  @OnEvent(FeeEvents.DELETE)
  async handleFeeDeletedEvent(event: FeeDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}