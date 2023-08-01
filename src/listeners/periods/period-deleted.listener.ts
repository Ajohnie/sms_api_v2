import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PeriodDeletedEvent, PeriodEvents } from "../../events/periods";

@Injectable()
export class PeriodDeletedListener {
  constructor() {
  }

  @OnEvent(PeriodEvents.DELETE)
  async handlePeriodDeletedEvent(event: PeriodDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}