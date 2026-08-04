import type { ProviderId } from '@goodboy/types';

export type ConnectRun = {
  runId: string | null;
  authScore: number;
  outputTail: string;
  stallTimer: number | null;
  probeTimer: number | null;
  timers: number[];
  unlisten: Array<() => void>;
};

type Params = {
  readonly providerId: ProviderId;
};

const RUNS = new Map<ProviderId, ConnectRun>();

export const getConnectRun = ({ providerId }: Params): ConnectRun | null => {
  return RUNS.get(providerId) ?? null;
};

type ClearStallTimerParams = {
  readonly run: ConnectRun;
};

export const clearStallTimer = ({ run }: ClearStallTimerParams): void => {
  if (run.stallTimer === null) {
    return;
  }
  window.clearTimeout(run.stallTimer);
  run.stallTimer = null;
};

export const disposeConnectRun = ({ providerId }: Params): void => {
  const run = RUNS.get(providerId);
  if (run === undefined) {
    return;
  }
  RUNS.delete(providerId);
  clearStallTimer({ run });
  if (run.probeTimer !== null) {
    window.clearTimeout(run.probeTimer);
    run.probeTimer = null;
  }
  for (const timer of run.timers) {
    window.clearTimeout(timer);
  }
  run.timers = [];
  for (const stop of run.unlisten) {
    stop();
  }
  run.unlisten = [];
};

export const openConnectRun = ({ providerId }: Params): ConnectRun => {
  disposeConnectRun({ providerId });
  const run: ConnectRun = {
    runId: null,
    authScore: 0,
    outputTail: '',
    stallTimer: null,
    probeTimer: null,
    timers: [],
    unlisten: [],
  };
  RUNS.set(providerId, run);
  return run;
};
