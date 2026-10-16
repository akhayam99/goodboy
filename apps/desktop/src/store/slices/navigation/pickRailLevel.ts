import { currentStack, stackKey } from './currentStack';
import { replaceTop } from './history';
import { RAIL_LEVEL_KEY, type RailLevel } from './railLevel';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly level: RailLevel;
};

export const pickRailLevel = (set: SetFn, get: GetFn) => {
  return ({ level }: Params): void => {
    const stack = currentStack(get());
    const top = stack.entries[stack.index];
    if (top === undefined || top.place.at !== 'session') {
      return;
    }
    const selection = { ...top.focus.selection, [RAIL_LEVEL_KEY]: level };
    const updated = replaceTop({ stack, next: { ...top, focus: { ...top.focus, selection } } });
    set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
  };
};
