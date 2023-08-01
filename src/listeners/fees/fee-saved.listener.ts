import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { FeeEvents, FeeSavedEvent } from "../../events/fees";

@Injectable()
export class FeeSavedListener {
  constructor() {
  }

  @OnEvent(FeeEvents.SAVE)
  handleFeeSavedEvent(event: FeeSavedEvent) {
  }
}