import type { Step, WorkflowOrchestrationOutcome, WorkflowRun } from '@goodboy/types';

type WorkflowDecision = {
  readonly stepId: string;
  readonly title: string;
  readonly reason: string;
};

type WorkflowClosingDecision = {
  readonly outcome: WorkflowOrchestrationOutcome;
  readonly label: string;
  readonly reason: string;
};

type Params = {
  readonly run: WorkflowRun;
  readonly steps: ReadonlyArray<Step>;
};

type Result = {
  readonly closing: WorkflowClosingDecision | null;
  readonly decisions: ReadonlyArray<WorkflowDecision>;
};

const OUTCOME_LABEL = {
  done: 'Run complete',
  blocked: 'Stopped, needs a human call',
} as const satisfies Record<WorkflowOrchestrationOutcome, string>;

export const decisionEntries = ({ run, steps }: Params): Result => {
  const decisions = [...steps]
    .sort((left, right) => right.ordinal - left.ordinal)
    .flatMap((step): ReadonlyArray<WorkflowDecision> => {
      const reason = step.orchestratorReason?.trim() ?? '';
      return reason === '' ? [] : [{ stepId: step.id, title: step.name, reason }];
    });
  const outcome = run.orchestrationOutcome;
  const closingReason = run.orchestrationReason?.trim() ?? '';
  const closing =
    outcome == null || closingReason === ''
      ? null
      : { outcome, label: OUTCOME_LABEL[outcome], reason: closingReason };
  return { closing, decisions };
};
