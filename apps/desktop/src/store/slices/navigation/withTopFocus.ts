import type { AppState } from '../../types';
import { stackKey } from './currentStack';
import { replaceTop } from './history';
import type { Focus } from './types';

type Params = {
  readonly state: AppState;
  readonly patch: Partial<Focus>;
};

export const withTopFocus = ({ state, patch }: Params): AppState['navigation'] => {
  const key = stackKey(state);
  const stack = state.navigation[key];
  const top = stack?.entries[stack.index];
  if (stack === undefined || top === undefined) {
    return state.navigation;
  }
  const updated = replaceTop({ stack, next: { ...top, focus: { ...top.focus, ...patch } } });
  return { ...state.navigation, [key]: updated };
};
