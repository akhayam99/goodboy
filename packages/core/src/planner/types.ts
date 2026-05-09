export interface PlannerStep {
  readonly name: string;
  readonly role: string;
  readonly promptPrefix: string;
  readonly expectedOutput: string;
}

export interface PlannerOutput {
  readonly workflowName: string;
  readonly reasoning: string;
  readonly steps: ReadonlyArray<PlannerStep>;
}

export interface PlannerInput {
  readonly theme: string;
  readonly repoContext?: string;
}
