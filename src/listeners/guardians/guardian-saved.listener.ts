import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { GuardianEvents, GuardianSavedEvent } from "../../events/guardians";

@Injectable()
export class GuardianSavedListener {
  constructor() {
  }

  @OnEvent(GuardianEvents.SAVE)
  handleGuardianSavedEvent(event: GuardianSavedEvent) {
  }
}