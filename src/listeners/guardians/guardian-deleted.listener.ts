import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { GuardianDeletedEvent, GuardianEvents } from "../../events/guardians";

@Injectable()
export class GuardianDeletedListener {
  constructor() {
  }

  @OnEvent(GuardianEvents.DELETE)
  async handleGuardianDeletedEvent(event: GuardianDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}