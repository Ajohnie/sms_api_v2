import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TermEvents, TermSavedEvent } from "../../events/terms";
import { ResultsService } from "../../results/results.service";

@Injectable()
export class TermSavedListener {
  constructor(private readonly results: ResultsService) {
  }

  @OnEvent(TermEvents.SAVE)
  handleTermSavedEvent(event: TermSavedEvent) {
    if (event.updated) {
      // update related results - if alias was changed
      const term_ids = event.after.id;
      return this.results.getResultsByOptions({ term_ids }).then((relevant_results) => {
        relevant_results.forEach((result) => result.updateTerm(event.before, event.after));
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