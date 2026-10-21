import { currentStack } from './currentStack';
import { goHistory } from './goHistory';
import { locationKey } from './locationKey';
import type { GetFn, Place, SetFn } from './types';

type Params = {
  readonly to: Place;
};

export const upTo = (set: SetFn, get: GetFn) => {
  return ({ to }: Params): void => {
    const stack = currentStack(get());
    const previous = stack.entries[stack.index - 1];
    if (previous !== undefined && locationKey(previous) === locationKey({ place: to })) {
      goHistory({ set, get, delta: -1 });
      return;
    }
    get().navigate({ to });
  };
};
