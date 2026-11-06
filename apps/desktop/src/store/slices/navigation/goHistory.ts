import { keepToolDrawer } from '../drawer/keepToolDrawer';
import { applyLocation } from './applyLocation';
import { currentStack, stackKey } from './currentStack';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly delta: number;
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
  const drawer = entry.focus.drawer ?? keepToolDrawer({ state, place: entry.place });
  applyLocation({
    set,
    get,
    location:
      drawer === entry.focus.drawer ? entry : { ...entry, focus: { ...entry.focus, drawer } },
    isRestore: true,
  });
  return true;
};
