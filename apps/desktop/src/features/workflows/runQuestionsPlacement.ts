import type {
  OpenQuestion,
  WorkflowOrchestrationStop,
  WorkflowOrchestrationStopKind,
} from '@goodboy/types';
import type { OrchestratorPhase } from './orchestratorState';
import type { RunPrimary, RunPrimaryKind } from './runPrimaryOf';

export type RunQuestionsPlacement = 'hidden' | 'before-state' | 'after-state';

type Params = {
  readonly phase: OrchestratorPhase;
  readonly questions: ReadonlyArray<Pick<OpenQuestion, 'isBlocking'>>;
};

const STOPPED_PHASES: ReadonlySet<OrchestratorPhase> = new Set([
  'paused',
  'paused-budget',
  'failed',
  'stopped',
  'needs-approval',
  'plan-approval',
]);

const STOP_ACTION_KINDS: ReadonlySet<RunPrimaryKind> = new Set([
  'resume',
  'raise-cap',
  'continue',
  'retry',
  'review-plan',
  'approve-plan',
]);

type ActionParams = {
  readonly primary: RunPrimary | null;
};

export const runQuestionsActionOf = ({ primary }: ActionParams): RunPrimary | null =>
  primary !== null && STOP_ACTION_KINDS.has(primary.kind) ? primary : null;

type HintParams = {
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

export const runQuestionsHintOf = ({ stop }: HintParams): string =>
  stop == null ? RESUME_HINT : (HINT_BY_STOP[stop.kind] ?? RESUME_HINT);

export const runQuestionsPlacementOf = ({ phase, questions }: Params): RunQuestionsPlacement => {
  if (questions.length === 0) {
    return 'hidden';
  }
  if (phase === 'needs-answer') {
    return 'after-state';
  }
  if (!STOPPED_PHASES.has(phase)) {
    return 'hidden';
  }
  return questions.some((question) => question.isBlocking) ? 'before-state' : 'after-state';
};
