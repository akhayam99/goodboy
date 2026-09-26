import { currentStack } from './currentStack';
import { goHistory } from './goHistory';
import type { GetFn, SetFn } from './types';

export type GoToHistoryParams = {
  readonly index: number;
};

export const goToHistory = (set: SetFn, get: GetFn) => {
  return ({ index }: GoToHistoryParams): void => {
    const delta = index - currentStack(get()).index;
    if (delta === 0) {
      return;
    }
    goHistory({ set, get, delta });
  };
};
