import { formatUsd } from '@goodboy/ui';
import type { Tone, WorkNodeState } from '@goodboy/ui';
import { NAMES } from '../../shared/utils/names';
import { ORCHESTRATOR_DECIDING_SENTENCE } from '../workflows/orchestratorCopy';
import { REVIEW_COMMENT_NODE, REVIEW_COMMENT_TONE } from '../resolve/reviewCommentState';
import type { RowPhase, RowState, RowStateReason } from './rowState';

export type RowNodeState = Exclude<WorkNodeState, 'marker' | 'mixed' | 'finished' | 'merging'>;

export const ROW_NODE_LABEL: Record<RowNodeState, string> = {
  queued: NAMES.queued,
  ready: NAMES.ready,
  running: NAMES.running,
  question: NAMES.needsYou,
  budget: NAMES.paused,
  approval: NAMES.waitingForPermission,
  alert: NAMES.needsYou,
  failed: NAMES.failed,
  approved: 'Approved',
  done: NAMES.done,
  closed: 'Closed by you',
  stopped: 'Stopped by you',
  skipped: 'Skipped',
};

export const NOT_FINISHED = NAMES.notFinished;

type ReasonParams = {
  readonly reason: RowStateReason;
};

type QuietParams = {
  readonly quietMs: number;
};

const QUIET_MINUTE_MS = 60_000;
const QUIET_HOUR_MINUTES = 120;

export const quietSentence = ({ quietMs }: QuietParams): string => {
  const minutes = Math.max(1, Math.floor(quietMs / QUIET_MINUTE_MS));
  if (minutes < QUIET_HOUR_MINUTES) {
    return `Quiet for ${minutes} min`;
  }
  return `Quiet for ${Math.floor(minutes / 60)} h`;
};

const reasonSentence = ({ reason }: ReasonParams): string | null => {
  switch (reason.kind) {
    case 'ready':
      return reason.stepLabel == null ? NAMES.ready : `Step ${reason.stepLabel} is ready`;
    case 'question':
      return reason.stepLabel == null
        ? 'Needs your answer'
        : `Needs your answer in step ${reason.stepLabel}`;
    case 'stepAsking':
    case 'openQuestions':
      return null;
    case 'budget':
      return reason.limitUsd == null
        ? 'Paused at the limit'
        : `Paused at the ${formatUsd(reason.limitUsd)} limit`;
    case 'failed':
      return NAMES.failed;
    case 'blocked':
      return 'Tell it what to do next';
    case 'noArtifact':
      return 'No artifact, use Retry capture in the transcript';
    case 'needsApproval':
      return 'Needs permission';
    case 'stepFailed':
      return reason.stepLabel == null ? 'A step failed' : `Step ${reason.stepLabel} failed`;
    case 'stepBlocked':
      return reason.stepLabel == null
        ? "A step isn't finished"
        : `Step ${reason.stepLabel} not finished`;
    case 'orchestratorFailed':
      return 'The orchestrator failed';
    case 'stopped':
      return 'Stopped by you';
    case 'agentStopped':
      if (reason.isCutStep === true) {
        return NOT_FINISHED;
      }
      return reason.by === 'app' ? 'Stopped by restart' : 'Stopped by you';
    case 'stepStopped':
      return reason.stepLabel == null
        ? 'A step was stopped'
        : `Step ${reason.stepLabel} stopped by you`;
    case 'deciding':
      return ORCHESTRATOR_DECIDING_SENTENCE;
    case 'briefing':
      return 'Briefing the next step';
    case 'chatTurn':
      return 'Waits for the chat to finish';
    case 'closed':
      return 'Closed by you';
    case 'skipped':
      return 'Skipped';
    case 'notFinished':
      return NOT_FINISHED;
    case 'didNotStart':
      return NAMES.notStarted;
    case 'without':
      return `Without ${reason.steps}`;
    case 'paused':
      return 'Paused by you';
    case 'planReady':
      return 'Plan needs approval';
    case 'chained':
      return `Starts after ${reason.afterTitle}`;
    case 'awaitingFirstMessage':
      return 'Write to start';
    case 'discarded':
      return null;
    case 'job':
    case 'review':
    case 'auto':
      return reason.word;
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
    case 'stepAsking':
    case 'openQuestions':
      return null;
    case 'budget':
    case 'paused':
      return NAMES.paused;
    case 'planReady':
      return 'Plan ready';
    case 'orchestratorFailed':
      return 'Orchestrator failed';
    case 'agentStopped':
      return reason.isCutStep === true ? NOT_FINISHED : 'Stopped';
    case 'stopped':
    case 'stepStopped':
      return 'Stopped';
    case 'deciding':
      return 'Choosing';
    case 'briefing':
      return 'Preparing';
    case 'chatTurn':
      return 'Waits for chat';
    case 'closed':
      return 'Closed';
    case 'chained':
      return NAMES.queued;
    case 'awaitingFirstMessage':
      return 'Write to start';
    case 'blocked':
      return NAMES.needsYou;
    case 'noArtifact':
      return 'No artifact';
    case 'needsApproval':
      return 'Needs permission';
    case 'stepBlocked':
      return reason.stepLabel == null
        ? 'Step not finished'
        : `Step ${reason.stepLabel} not finished`;
    case 'auto':
      return reason.short;
    case 'failed':
    case 'stepFailed':
    case 'skipped':
    case 'notFinished':
    case 'didNotStart':
    case 'without':
    case 'discarded':
    case 'job':
    case 'review':
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
  'stepAsking',
  'openQuestions',
  'agentStopped',
  'stepStopped',
]);

const isRowStoppedByUser = ({ state }: StateParams): boolean =>
  state.reason?.kind === 'agentStopped' || state.reason?.kind === 'stepStopped';

export const rowStateTone = ({ state }: StateParams): Tone => {
  if (state.reason?.kind === 'review') {
    return REVIEW_COMMENT_TONE[state.reason.state];
  }
  if (state.reason?.kind === 'notFinished') {
    return 'warning';
  }
  return state.reason != null && NEUTRAL_REASONS.has(state.reason.kind)
    ? 'neutral'
    : PHASE_TONE[state.phase];
};

export type RowNode = {
  readonly state: RowNodeState;
  readonly label: string;
};

const nodeStateOf = ({ state }: StateParams): RowNode['state'] => {
  if (state.reason?.kind === 'review') {
    return state.reason.state === 'ready' || state.reason.state === 'edited'
      ? 'ready'
      : REVIEW_COMMENT_NODE[state.reason.state];
  }
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
      if (state.reason?.kind === 'stepAsking') {
        return 'queued';
      }
      if (state.reason?.kind === 'budget' || state.reason?.kind === 'paused') {
        return 'budget';
      }
      if (
        state.reason?.kind === 'blocked' ||
        state.reason?.kind === 'stepBlocked' ||
        state.reason?.kind === 'noArtifact' ||
        state.reason?.kind === 'needsApproval'
      ) {
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
  if (
    state.reason?.kind === 'review' ||
    state.reason?.kind === 'job' ||
    state.reason?.kind === 'auto'
  ) {
    return { state: node, label: state.reason.word };
  }
  if (state.reason?.kind === 'deciding') {
    return { state: node, label: ORCHESTRATOR_DECIDING_SENTENCE };
  }
  if (state.reason?.kind === 'discarded') {
    return { state: node, label: 'Discarded' };
  }
  if (state.reason?.kind === 'paused') {
    return { state: node, label: 'Paused by you' };
  }
  if (state.reason?.kind === 'stepAsking') {
    return { state: node, label: 'Waiting on a step' };
  }
  if (state.reason?.kind === 'blocked') {
    return { state: node, label: NAMES.needsYou };
  }
  if (state.reason?.kind === 'stepBlocked') {
    return { state: node, label: NOT_FINISHED };
  }
  if (state.reason?.kind === 'noArtifact') {
    return { state: node, label: 'No artifact' };
  }
  if (state.reason?.kind === 'needsApproval') {
    return { state: node, label: 'Needs permission' };
  }
  if (state.reason?.kind === 'planReady') {
    return { state: node, label: 'Plan ready' };
  }
  if (state.reason?.kind === 'agentStopped' && state.reason.by === 'app') {
    return { state: node, label: 'Stopped by restart' };
  }
  if (state.reason?.kind === 'agentStopped' && state.reason.isCutStep === true) {
    return { state: node, label: NOT_FINISHED };
  }
  return { state: node, label: ROW_NODE_LABEL[node] };
};
