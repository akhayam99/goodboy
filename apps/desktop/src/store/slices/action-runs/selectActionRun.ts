import type { ActionRunsState } from './state';
import type { ActionRun } from './types';

type Params = {
  readonly state: ActionRunsState;
  readonly key: string | null;
};

export const selectActionRun = ({ state, key }: Params): ActionRun | null =>
  key === null ? null : (state.actionRuns[key] ?? null);
