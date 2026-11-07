import type { AppState } from '../../types';
import { stackKey } from './currentStack';
import type { RunGroupFocus } from './types';

type Params = {
  readonly state: AppState;
};

export const runGroupFocusOf = ({ state }: Params): RunGroupFocus | null => {
  const stack = state.navigation[stackKey(state)];
  return stack?.entries[stack.index]?.focus.runGroup ?? null;
};
