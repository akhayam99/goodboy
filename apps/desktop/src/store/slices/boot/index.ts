import { hydrate, retryHydrate } from './hydrate';
import { loadDetectedEditors } from './loadDetectedEditors';
import type { GetFn, SetFn } from './types';

export const createBootSlice = (set: SetFn, get: GetFn) => {
  return {
    hydrate: hydrate(set, get),
    retryHydrate: retryHydrate(get),
    loadDetectedEditors: loadDetectedEditors(set, get),
  };
};
