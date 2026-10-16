import type { WorkflowRunHistoryRow } from '@goodboy/db';
import type { DotState } from '@goodboy/ui';

export type RunHistoryStateKey = 'running' | 'failed' | 'done' | 'stopped' | 'waiting' | 'queued';

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
  waiting: { key: 'waiting', label: 'Waiting for you', dot: 'needsYou' },
  queued: { key: 'queued', label: 'Not started', dot: 'idle' },
};

const isDone = ({ run }: Params): boolean => {
  if (run.executionMode === 'dynamic') {
    return run.orchestrationOutcome === 'done';
  }
  return run.stepCount > 0 && run.finishedSteps >= run.stepCount;
};

export const runHistoryState = ({ run }: Params): RunHistoryState => {
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
