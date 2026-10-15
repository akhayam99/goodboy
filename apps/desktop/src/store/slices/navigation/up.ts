import { captureLocation } from './captureLocation';
import { currentStack } from './currentStack';
import { goHistory } from './goHistory';
import { locationKey } from './locationKey';
import { parentPlace } from './parentPlace';
import type { GetFn, SetFn } from './types';

export const up = (set: SetFn, get: GetFn) => {
  return (): void => {
    const state = get();
    const live = captureLocation({ state });
    if (live.studio !== null) {
      get().closeStudio();
      return;
    }
    const parent = parentPlace({ state, place: live.place });
    if (parent === null) {
      return;
    }
    const stack = currentStack(state);
    const previous = stack.entries[stack.index - 1];
    if (previous !== undefined && locationKey(previous) === locationKey({ place: parent })) {
      goHistory({ set, get, delta: -1 });
      return;
    }
    get().navigate({ to: parent });
  };
};
