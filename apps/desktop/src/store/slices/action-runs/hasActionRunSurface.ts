import type { ActionRunsState } from './state';

type Params = {
  readonly state: ActionRunsState;
  readonly key: string | null;
};

export const hasActionRunSurface = ({ state, key }: Params): boolean =>
  key !== null && (state.actionRunSurfaces[key] ?? 0) > 0;
