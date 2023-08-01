import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TeacherEvents, TeacherSavedEvent } from "../../events/teachers";

@Injectable()
export class TeacherSavedListener {
  constructor() {
  }

  @OnEvent(TeacherEvents.SAVE)
  handleTeacherSavedEvent(event: TeacherSavedEvent) {
  }
}