import { loadSessionContextSeen } from './loadSessionContextSeen';
import { markContextRead } from './markContextRead';
import { openContextDrawer } from './openContextDrawer';
import type { SliceDeps } from '../../slice-types';

export const createContextDrawerSlice = ({ set, get }: SliceDeps) => {
  return {
    openContextDrawer: openContextDrawer(set, get),
    loadSessionContextSeen: loadSessionContextSeen(set, get),
    markContextRead: markContextRead({ set }),
  };
};
