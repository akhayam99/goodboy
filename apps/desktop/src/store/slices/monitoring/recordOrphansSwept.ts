import type { SetFn } from './types';

type Params = {
  readonly count: number;
};

export const recordOrphansSwept = (set: SetFn) => {
  return ({ count }: Params): void => {
    set({ monitorSweptCount: count });
  };
};
