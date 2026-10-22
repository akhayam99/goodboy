import type { SessionRun } from './sessionRunsOf';

export type SessionRunCounts = Readonly<{
  runs: number;
  runningRuns: number;
  waitingRuns: number;
  inProgress: number;
}>;

type Params = {
  readonly runs: ReadonlyArray<SessionRun>;
};

export const sessionRunCountsOf = ({ runs }: Params): SessionRunCounts => {
  const live = runs.filter((run) => !run.isArchived);
  const inProgress = live.filter((run) => run.isInProgress);
  const waiting = inProgress.filter((run) => run.isWaiting);
  return {
    runs: live.length,
    runningRuns: inProgress.length - waiting.length,
    waitingRuns: waiting.length,
    inProgress: inProgress.length,
  };
};
