import type { OpenQuestion, WorkflowOrchestrationStop } from '@goodboy/types';
import type { OrchestratorPhase } from './orchestratorState';

export type RunQuestionsPlacement = 'hidden' | 'before-state' | 'after-state';

type Params = {
  readonly phase: OrchestratorPhase | null;
  readonly stop: WorkflowOrchestrationStop | null | undefined;
  readonly questions: ReadonlyArray<Pick<OpenQuestion, 'isBlocking'>>;
};

const PLANNER_PHASES: ReadonlySet<OrchestratorPhase> = new Set(['plan-question', 'plan-revising']);

const STOPPED_PHASES: ReadonlySet<OrchestratorPhase> = new Set([
  'paused',
  'paused-budget',
  'failed',
  'stopped',
  'needs-approval',
  'plan-approval',
]);

export const runQuestionsPlacementOf = ({
  phase,
  stop,
  questions,
}: Params): RunQuestionsPlacement => {
  if (questions.length === 0) {
    return 'hidden';
  }
  if (phase === 'needs-answer') {
    return 'after-state';
  }
  if (phase !== null && PLANNER_PHASES.has(phase)) {
    return 'hidden';
  }
  const isStopped =
    (stop != null && stop.kind !== 'questions') || (phase !== null && STOPPED_PHASES.has(phase));
  if (!isStopped) {
    return phase === null ? 'after-state' : 'hidden';
  }
  return questions.some((question) => question.isBlocking) ? 'before-state' : 'after-state';
};
