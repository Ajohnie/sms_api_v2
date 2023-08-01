import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ExamEvents, ExamSavedEvent } from "../../events/exams";
import { ResultsService } from "../../results/results.service";

@Injectable()
export class ExamSavedListener {
  constructor(private readonly results: ResultsService) {
  }

  @OnEvent(ExamEvents.SAVE)
  handleExamSavedEvent(event: ExamSavedEvent) {
    if (event.updated) {
      // update related results - if alias was changed
      const exam_ids = event.after.id;
      return this.results.getResultsByOptions({ exam_ids }).then((relevant_results) => {
        relevant_results.forEach((result) => result.updateExam(event.before, event.after));
        if (relevant_results.length === 0) {
          return true;
        }
        return this.results.saveResults(relevant_results)
          .then(() => true)
          .catch((reason) => console.error(reason));
      });
    }
  }
}