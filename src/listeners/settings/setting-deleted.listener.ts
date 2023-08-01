import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SettingDeletedEvent, SettingEvents } from "../../events/settings";

@Injectable()
export class SettingDeletedListener {
  constructor() {
  }

  @OnEvent(SettingEvents.DELETE)
  async handleSettingDeletedEvent(event: SettingDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}