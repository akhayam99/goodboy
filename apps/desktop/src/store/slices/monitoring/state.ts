import type { LearnedPorts, LedgerRow, MonitorSnapshot, WatchedPort } from '@goodboy/core';
import type { StopProgress } from './types';

export type MonitoringSliceState = {
  readonly monitorSnapshot: MonitorSnapshot | null;
  readonly monitorLedger: ReadonlyArray<LedgerRow>;
  readonly monitorError: string | null;
  readonly monitorScanned: Readonly<Record<string, ReadonlyArray<WatchedPort>>>;
  readonly monitorWatched: Readonly<Record<string, ReadonlyArray<number>>>;
  readonly monitorLearned: LearnedPorts;
  readonly monitorStopping: Readonly<Record<number, StopProgress>>;
  readonly monitorSweptCount: number;
};

export const monitoringInitialState: MonitoringSliceState = {
  monitorSnapshot: null,
  monitorLedger: [],
  monitorError: null,
  monitorScanned: {},
  monitorWatched: {},
  monitorLearned: {},
  monitorStopping: {},
  monitorSweptCount: 0,
};
