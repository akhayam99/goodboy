import type { ResolvedAction } from './types';

export const MAX_OVERFLOW_ROWS = 5;

type Params = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly cuts: ReadonlyArray<string>;
};

export const overflowCutOf = ({ actions, cuts }: Params): ReadonlyArray<string> => {
  const excess = actions.length - MAX_OVERFLOW_ROWS;
  if (excess <= 0) {
    return [];
  }
  return cuts.filter((id) => actions.some((action) => action.id === id)).slice(0, excess);
};
