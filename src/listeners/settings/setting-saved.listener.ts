import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SettingEvents, SettingSavedEvent } from "../../events/settings";

@Injectable()
export class SettingSavedListener {
  @OnEvent(SettingEvents.SAVE)
  handleSettingSavedEvent(event: SettingSavedEvent) {
  }
}