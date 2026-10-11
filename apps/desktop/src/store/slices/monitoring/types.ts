export type { SetFn, GetFn } from '../../slice-types';

export type WatchPortParams = {
  readonly projectId: string;
  readonly port: number;
};

type StopOutcome = 'stopped' | 'still-running' | 'refused';

export type StopResult = {
  readonly outcome: StopOutcome;
  readonly reason: string | null;
};

export type StopProgress = 'stopping' | 'still-running';

export type StopProcessParams = {
  readonly pid: number;
  readonly isForced: boolean;
};

export type StopGoodboyRowParams = {
  readonly spawnId: string;
};

export type StopLeftoversParams = {
  readonly pids: ReadonlyArray<number>;
};
