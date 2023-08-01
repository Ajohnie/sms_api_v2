import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ExamDeletedEvent, ExamEvents } from "../../events/exams";

@Injectable()
export class ExamDeletedListener {
  constructor() {
  }

  @OnEvent(ExamEvents.DELETE)
  async handleExamDeletedEvent(event: ExamDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}