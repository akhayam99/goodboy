import type { WorkflowOrchestrationStop, WorkflowOrchestrationStopKind } from '@goodboy/types';
import type { TailState } from '../../../live-state/tailFacts';

type StoppedQuestionTail = {
  readonly state: TailState;
  readonly phrase: string;
};

type Params = {
  readonly stop: WorkflowOrchestrationStop | undefined;
};

const TAIL_BY_STOP: Readonly<
  Record<Exclude<WorkflowOrchestrationStopKind, 'questions'>, StoppedQuestionTail>
> = {
  budget: { state: 'paused', phrase: 'Paused at the limit' },
  failure: { state: 'failed', phrase: 'The run stopped on an error' },
  operator: { state: 'stopped', phrase: 'Stopped by you' },
  closed: { state: 'stopped', phrase: 'Stopped by you' },
  paused: { state: 'stopped', phrase: 'Paused by you' },
  'needs-approval': { state: 'waiting', phrase: 'Paused · needs your approval' },
  'plan-approval': { state: 'waiting', phrase: 'The plan waits for your review' },
  'preset-change': { state: 'waiting', phrase: 'Paused · the preset needs your call' },
};

export const stoppedQuestionTailOf = ({ stop }: Params): StoppedQuestionTail | null =>
  stop === undefined || stop.kind === 'questions' ? null : TAIL_BY_STOP[stop.kind];
