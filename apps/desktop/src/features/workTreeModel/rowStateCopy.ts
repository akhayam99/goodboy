import { formatUsd } from '@goodboy/ui';
import type { Tone, WorkNodeState } from '@goodboy/ui';
import { ORCHESTRATOR_DECIDING_SENTENCE } from '../workflows/orchestratorCopy';
import type { RowPhase, RowState, RowStateReason } from './rowState';

export const ROW_NODE_LABEL: Record<Exclude<WorkNodeState, 'marker'>, string> = {
  queued: 'Not started',
  ready: 'Ready to run',
  running: 'Running',
  question: 'Waiting on your answer',
  budget: 'Paused at the spend limit',
  failed: 'Failed',
  done: 'Done',
  closed: 'Closed by you',
  stopped: 'Stopped by you',
  skipped: 'Skipped',
};

type ReasonParams = {
  readonly reason: RowStateReason;
};

const reasonSentence = ({ reason }: ReasonParams): string | null => {
  switch (reason.kind) {
    case 'ready':
      return reason.stepLabel == null ? 'Ready to run' : `Step ${reason.stepLabel} is ready to run`;
    case 'question':
      return reason.stepLabel == null
        ? 'Needs your answer'
        : `Needs your answer in step ${reason.stepLabel}`;
    case 'budget':
      return reason.limitUsd == null
        ? 'Paused at the spend limit'
        : `Paused at the ${formatUsd(reason.limitUsd)} spend limit`;
    case 'failed':
      return 'Failed';
    case 'stepFailed':
      return reason.stepLabel == null ? 'A step failed' : `Step ${reason.stepLabel} failed`;
    case 'orchestratorFailed':
      return 'The orchestrator failed';
    case 'stopped':
      return 'Stopped by you';
    case 'deciding':
      return ORCHESTRATOR_DECIDING_SENTENCE;
    case 'briefing':
      return 'Briefing the next step';
    case 'chatTurn':
      return 'Waiting for the chat turn to finish';
    case 'closed':
      return 'Closed by you';
    case 'skipped':
      return 'Skipped';
    case 'chained':
      return `Starts after ${reason.afterTitle}`;
    case 'discarded':
      return null;
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
};

type StateParams = {
  readonly state: RowState;
};

export const rowStateSentence = ({ state }: StateParams): string | null =>
  state.reason == null ? null : reasonSentence({ reason: state.reason });

const PHASE_TONE: Record<RowPhase, Tone> = {
  queued: 'neutral',
  running: 'neutral',
  waiting: 'warning',
  failed: 'danger',
  done: 'neutral',
  closed: 'neutral',
  skipped: 'neutral',
};

export const rowStateTone = ({ state }: StateParams): Tone =>
  state.reason?.kind === 'discarded' ? 'neutral' : PHASE_TONE[state.phase];

export type RowNode = {
  readonly state: Exclude<WorkNodeState, 'marker'>;
  readonly label: string;
};

const nodeStateOf = ({ state }: StateParams): RowNode['state'] => {
  switch (state.phase) {
    case 'queued':
      return 'queued';
    case 'running':
      return 'running';
    case 'waiting':
      return state.reason?.kind === 'ready'
        ? 'ready'
        : state.reason?.kind === 'budget'
          ? 'budget'
          : 'question';
    case 'failed':
      return 'failed';
    case 'done':
      return 'done';
    case 'closed':
      return state.reason?.kind === 'stopped' ? 'stopped' : 'closed';
    case 'skipped':
      return 'skipped';
    default: {
      const exhaustive: never = state.phase;
      return exhaustive;
    }
  }
};

export const rowStateNode = ({ state }: StateParams): RowNode => {
  const node = nodeStateOf({ state });
  if (state.reason?.kind === 'deciding') {
    return { state: node, label: ORCHESTRATOR_DECIDING_SENTENCE };
  }
  if (state.reason?.kind === 'discarded') {
    return { state: node, label: 'Discarded' };
  }
  return { state: node, label: ROW_NODE_LABEL[node] };
};
