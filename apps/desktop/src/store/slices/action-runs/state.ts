import type { ActionRun } from './types';

export type ActionRunsState = {
  readonly actionRuns: Readonly<Record<string, ActionRun>>;
};

export const actionRunsInitialState: ActionRunsState = {
  actionRuns: {},
};
