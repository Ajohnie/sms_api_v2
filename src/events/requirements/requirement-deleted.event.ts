export class RequirementDeletedEvent {
  requirementId: string;

  constructor(requirementId: string) {
    this.requirementId = requirementId;
  }
}