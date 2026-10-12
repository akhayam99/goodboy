import type { HiddenPortSource } from '@goodboy/core';

export type { SetFn, GetFn } from '../../slice-types';

export type PinPortParams = {
  readonly port: number;
  readonly description: string;
};

export type UnpinPortParams = {
  readonly port: number;
};

export type HidePortParams = {
  readonly port: number;
  readonly source: HiddenPortSource;
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
