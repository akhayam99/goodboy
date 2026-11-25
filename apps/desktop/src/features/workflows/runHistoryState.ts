import { NAMES } from '../../shared/utils/names';
import { isAutoBudgetBlock, leadStopOf, type LeadStopState } from '@goodboy/core/auto';
import type { WorkflowRunHistoryRow, WorkflowRunLeadFacts } from '@goodboy/db';
import type { DotState } from '@goodboy/ui';

export type RunHistoryStateKey =
  'running' | 'failed' | 'done' | 'stopped' | 'waiting' | 'queued' | 'idle';

export type RunHistoryState = {
  readonly key: RunHistoryStateKey;
  readonly label: string;
  readonly dot: DotState;
};

type Params = {
  readonly run: WorkflowRunHistoryRow;
};

const STATES: Readonly<Record<RunHistoryStateKey, RunHistoryState>> = {
  running: { key: 'running', label: 'Running', dot: 'running' },
  failed: { key: 'failed', label: 'Failed', dot: 'failed' },
  done: { key: 'done', label: 'Done', dot: 'done' },
  stopped: { key: 'stopped', label: 'Stopped', dot: 'idle' },
  waiting: { key: 'waiting', label: NAMES.needsYou, dot: 'needsYou' },
  queued: { key: 'queued', label: 'Not started', dot: 'idle' },
  idle: { key: 'idle', label: NAMES.idle, dot: 'idle' },
};

type LeadParams = {
  readonly lead: WorkflowRunLeadFacts;
};

const isSpent = ({ lead }: LeadParams): boolean =>
  lead.remainingUsd !== null && Math.round(lead.remainingUsd * 100) <= 0;

const isPausedAtLimit = ({ lead }: LeadParams): boolean =>
  (lead.phase === 'blocked' && isAutoBudgetBlock({ reason: lead.blockedReason })) ||
  (lead.phase !== 'blocked' && isSpent({ lead }));

const leadStateOf = ({ lead }: LeadParams): LeadStopState =>
  leadStopOf({
    phase: lead.phase,
    isRootTurnLive: lead.isTurnLive,
    isPlanReady: false,
    isAsking: lead.isAsking,
    isPausedAtLimit: isPausedAtLimit({ lead }),
  });

const leadHistoryState = ({ lead }: LeadParams): RunHistoryState => {
  const stop = leadStateOf({ lead });
  switch (stop.stop) {
    case 'working':
      return STATES.running;
    case 'waitsForYou':
      return stop.reason === 'failed' ? STATES.failed : STATES.waiting;
    case 'resting':
      return STATES.idle;
    case 'stopped':
      return STATES.stopped;
    case 'finished':
      return STATES.done;
    default: {
      const exhaustive: never = stop.stop;
      return exhaustive;
    }
  }
};

const isDone = ({ run }: Params): boolean => {
  if (run.executionMode === 'dynamic') {
    return run.orchestrationOutcome === 'done';
  }
  return run.stepCount > 0 && run.finishedSteps >= run.stepCount;
};

export const runHistoryState = ({ run }: Params): RunHistoryState => {
  if (run.lead !== null) {
    return leadHistoryState({ lead: run.lead });
  }
  if (run.runningSteps > 0) {
    return STATES.running;
  }
  if (run.failedSteps > 0 || run.orchestrationOutcome === 'blocked') {
    return STATES.failed;
  }
  if (isDone({ run })) {
    return STATES.done;
  }
  if (run.stoppedSteps > 0) {
    return STATES.stopped;
  }
  if (run.startedSteps === 0) {
    return STATES.queued;
  }
  return STATES.waiting;
};
