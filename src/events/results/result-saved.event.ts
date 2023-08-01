import { Result } from "../../lib";

export class ResultSavedEvent {
  result: Result;

  constructor(result: Result) {
    this.result = result;
  }
}