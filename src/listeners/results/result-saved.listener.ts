import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ResultEvents, ResultSavedEvent } from "../../events/results";

@Injectable()
export class ResultSavedListener {
  @OnEvent(ResultEvents.SAVE)
  handleResultSavedEvent(event: ResultSavedEvent) {
  }
}