import type { OpenQuestion } from '@goodboy/types';
import type { OrchestratorPhase } from './orchestratorState';

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
