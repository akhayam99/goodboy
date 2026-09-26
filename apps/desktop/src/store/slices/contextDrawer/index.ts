import { loadSessionContextSeen } from './loadSessionContextSeen';
import { markSessionContextSeen } from './markSessionContextSeen';
import { openContextDrawer } from './openContextDrawer';
import { toggleContextDrawer } from './toggleContextDrawer';
import type { GetFn, SetFn } from './types';

export const createContextDrawerSlice = (set: SetFn, get: GetFn) => {
  return {
    openContextDrawer: openContextDrawer(set, get),
    toggleContextDrawer: toggleContextDrawer(get),
    loadSessionContextSeen: loadSessionContextSeen(set, get),
    markSessionContextSeen: markSessionContextSeen(set),
  };
};
