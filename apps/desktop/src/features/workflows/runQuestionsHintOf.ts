import type { WorkflowOrchestrationStop, WorkflowOrchestrationStopKind } from '@goodboy/types';

type Params = {
  readonly stop: WorkflowOrchestrationStop | null | undefined;
};

const RESUME_HINT = 'Resume the run to answer';

const HINT_BY_STOP: Readonly<Record<WorkflowOrchestrationStopKind, string>> = {
  budget: 'Raise the limit to answer',
  failure: 'Retry the run to answer',
  questions: RESUME_HINT,
  operator: 'Continue the run to answer',
  closed: RESUME_HINT,
  'needs-approval': 'Approve to answer',
  'plan-approval': 'Approve the plan to answer',
  paused: RESUME_HINT,
  'preset-change': 'Decide on the preset to answer',
};

export const runQuestionsHintOf = ({ stop }: Params): string =>
  stop == null ? RESUME_HINT : (HINT_BY_STOP[stop.kind] ?? RESUME_HINT);
