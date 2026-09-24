import type { StepSize } from '@goodboy/types';

export type PlannerStep = {
  readonly name: string;
  readonly role: string;
  readonly promptPrefix: string;
  readonly expectedOutput: string;
  readonly size: StepSize | null;
};

export type PlannerOutput = {
  readonly workflowName: string;
  readonly reasoning: string;
  readonly steps: ReadonlyArray<PlannerStep>;
};

export type PlannerInput = {
  readonly process: string;
  readonly repoContext?: string;
};
