import type { WorkflowOrchestrationStop, WorkflowOrchestrationStopKind } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
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
  budget: { state: 'paused', phrase: NAMES.needsYou },
  failure: { state: 'failed', phrase: NAMES.failed },
  operator: { state: 'stopped', phrase: NAMES.stopped },
  closed: { state: 'stopped', phrase: NAMES.stopped },
  paused: { state: 'stopped', phrase: NAMES.paused },
  'needs-approval': { state: 'waiting', phrase: NAMES.needsApproval },
  'plan-approval': { state: 'waiting', phrase: NAMES.needsApproval },
  'preset-change': { state: 'waiting', phrase: NAMES.needsYou },
};

export const stoppedQuestionTailOf = ({ stop }: Params): StoppedQuestionTail | null =>
  stop === undefined || stop.kind === 'questions' ? null : TAIL_BY_STOP[stop.kind];
