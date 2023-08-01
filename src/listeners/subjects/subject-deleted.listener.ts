import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SubjectDeletedEvent, SubjectEvents } from "../../events/subjects";

@Injectable()
export class SubjectDeletedListener {
  constructor() {
  }

  @OnEvent(SubjectEvents.DELETE)
  async handleSubjectDeletedEvent(event: SubjectDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}