import { hydrate } from './hydrate';
import type { GetFn, SetFn } from './types';

export function createBootSlice(set: SetFn, get: GetFn) {
  return {
    hydrate: hydrate(set, get),
  };
}
