import type { ActionRun } from './types';

export type ActionRunsState = {
  readonly actionRuns: Readonly<Record<string, ActionRun>>;
  readonly actionRunSurfaces: Readonly<Record<string, number>>;
};

export const actionRunsInitialState: ActionRunsState = {
  actionRuns: {},
  actionRunSurfaces: {},
};
