import type { LearnedPorts, LedgerRow, MonitorSnapshot, WatchedPort } from '@goodboy/core';

export type MonitoringSliceState = {
  readonly monitorSnapshot: MonitorSnapshot | null;
  readonly monitorLedger: ReadonlyArray<LedgerRow>;
  readonly monitorError: string | null;
  readonly monitorScanned: Readonly<Record<string, ReadonlyArray<WatchedPort>>>;
  readonly monitorWatched: Readonly<Record<string, ReadonlyArray<number>>>;
  readonly monitorLearned: LearnedPorts;
};

export const monitoringInitialState: MonitoringSliceState = {
  monitorSnapshot: null,
  monitorLedger: [],
  monitorError: null,
  monitorScanned: {},
  monitorWatched: {},
  monitorLearned: {},
};
