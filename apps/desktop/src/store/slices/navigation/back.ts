import { goHistory } from './goHistory';
import type { GetFn, SetFn } from './types';

export const back = (set: SetFn, get: GetFn) => {
  return (): void => {
    goHistory({ set, get, delta: -1 });
  };
};
