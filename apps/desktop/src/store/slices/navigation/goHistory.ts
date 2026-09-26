import { applyLocation } from './applyLocation';
import { currentStack, stackKey } from './currentStack';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly delta: -1 | 1;
};

export const goHistory = ({ set, get, delta }: Params): boolean => {
  const state = get();
  const stack = currentStack(state);
  const index = stack.index + delta;
  const entry = stack.entries[index];
  if (entry === undefined) {
    return false;
  }
  set((current) => ({
    navigation: { ...current.navigation, [stackKey(current)]: { ...stack, index } },
  }));
  applyLocation({ set, get, place: entry.place, isRestore: true });
  return true;
};
