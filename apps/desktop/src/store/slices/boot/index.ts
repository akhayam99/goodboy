import { hydrate } from './hydrate';
import type { GetFn, SetFn } from './types';

export const createBootSlice = (set: SetFn, get: GetFn) => {
  return {
    hydrate: hydrate(set, get),
  };
};
