import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SubjectEvents, SubjectSavedEvent } from "../../events/subjects";
import { ResultsService } from "../../results/results.service";

@Injectable()
export class SubjectSavedListener {
  constructor(private readonly results: ResultsService) {
  }

  @OnEvent(SubjectEvents.SAVE)
  handleSubjectSavedEvent(event: SubjectSavedEvent) {
    if (event.updated) {
      // update related results - if alias was changed
      const subject_ids = event.after.id;
      return this.results.getResultsByOptions({ subject_ids }).then((relevant_results) => {
        relevant_results.forEach((result) => result.updateSubject(event.before, event.after));
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