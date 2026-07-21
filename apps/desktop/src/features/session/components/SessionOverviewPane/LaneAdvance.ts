import type { Agent, Step, Workflow } from '@goodboy/types';

export type LaneAdvance = {
  readonly workflow: Workflow;
  readonly runs: ReadonlyArray<Agent>;
  readonly hasOpenQuestions: boolean;
  readonly onAdvance: (step: Step) => void | Promise<void>;
};
