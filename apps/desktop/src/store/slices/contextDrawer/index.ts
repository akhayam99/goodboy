import { loadSessionContextSeen } from './loadSessionContextSeen';
import { markSessionContextSeen } from './markSessionContextSeen';
import { openContextDrawer } from './openContextDrawer';
import { toggleContextDrawer } from './toggleContextDrawer';
import type { SliceDeps } from '../../slice-types';

export const createContextDrawerSlice = ({ set, get }: SliceDeps) => {
  return {
    openContextDrawer: openContextDrawer(set, get),
    toggleContextDrawer: toggleContextDrawer(get),
    loadSessionContextSeen: loadSessionContextSeen(set, get),
    markSessionContextSeen: markSessionContextSeen(set),
  };
};
