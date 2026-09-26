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
  approval: 'Waiting for your approval',
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
    case 'blocked':
      return 'Blocked, tell the agent what to do next';
    case 'stepFailed':
      return reason.stepLabel == null ? 'A step failed' : `Step ${reason.stepLabel} failed`;
    case 'stepBlocked':
      return reason.stepLabel == null
        ? 'A step is blocked, tell the agent what to do next'
        : `Step ${reason.stepLabel} is blocked, tell the agent what to do next`;
    case 'orchestratorFailed':
      return 'The orchestrator failed';
    case 'stopped':
      return 'Stopped by you';
    case 'agentStopped':
      return reason.by === 'app' ? 'Stopped when Goodboy quit' : 'Stopped by you';
    case 'stepStopped':
      return reason.stepLabel == null
        ? 'A step was stopped'
        : `Step ${reason.stepLabel} stopped by you`;
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
    case 'awaitingFirstMessage':
      return 'Waiting for your first message';
    case 'discarded':
      return null;
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
};

const reasonShortSentence = ({ reason }: ReasonParams): string | null => {
  switch (reason.kind) {
    case 'ready':
      return reason.stepLabel == null ? 'Ready' : `Step ${reason.stepLabel} ready`;
    case 'question':
      return 'Needs you';
    case 'budget':
      return 'At spend limit';
    case 'orchestratorFailed':
      return 'Orchestrator failed';
    case 'stopped':
    case 'agentStopped':
    case 'stepStopped':
      return 'Stopped';
    case 'deciding':
      return 'Choosing next';
    case 'briefing':
      return 'Briefing';
    case 'chatTurn':
      return 'Waits on chat';
    case 'closed':
      return 'Closed';
    case 'chained':
      return 'Chained';
    case 'awaitingFirstMessage':
      return 'Write to start';
    case 'blocked':
      return 'Blocked';
    case 'stepBlocked':
      return reason.stepLabel == null ? 'Step blocked' : `Step ${reason.stepLabel} blocked`;
    case 'failed':
    case 'stepFailed':
    case 'skipped':
    case 'discarded':
      return reasonSentence({ reason });
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

export const rowStateShortSentence = ({ state }: StateParams): string | null =>
  state.reason == null ? null : reasonShortSentence({ reason: state.reason });

const NEUTRAL_REASONS: ReadonlySet<RowStateReason['kind']> = new Set([
  'discarded',
  'agentStopped',
  'stepStopped',
]);

export const isRowStoppedByUser = ({ state }: StateParams): boolean =>
  state.reason?.kind === 'agentStopped' || state.reason?.kind === 'stepStopped';

export const rowStateTone = ({ state }: StateParams): Tone =>
  state.reason != null && NEUTRAL_REASONS.has(state.reason.kind)
    ? 'neutral'
    : PHASE_TONE[state.phase];

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
      if (isRowStoppedByUser({ state })) {
        return 'stopped';
      }
      if (state.reason?.kind === 'ready') {
        return 'ready';
      }
      if (state.reason?.kind === 'budget') {
        return 'budget';
      }
      if (state.reason?.kind === 'blocked' || state.reason?.kind === 'stepBlocked') {
        return 'approval';
      }
      return 'question';
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
  if (state.reason?.kind === 'blocked' || state.reason?.kind === 'stepBlocked') {
    return { state: node, label: 'Blocked' };
  }
  if (state.reason?.kind === 'agentStopped' && state.reason.by === 'app') {
    return { state: node, label: 'Stopped when Goodboy quit' };
  }
  return { state: node, label: ROW_NODE_LABEL[node] };
};
