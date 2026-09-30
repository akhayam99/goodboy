import { changeSessionBranch } from './changeSessionBranch';
import { reconcileOrphanWorktrees } from './reconcileOrphanWorktrees';
import { reconcileSessionBranch } from './reconcileSessionBranch';
import type { SliceDeps } from '../../slice-types';

export const createWorktreesSlice = ({ set, get }: SliceDeps) => {
  return {
    changeSessionBranch: changeSessionBranch(set, get),
    reconcileSessionBranch: reconcileSessionBranch(set, get),
    reconcileOrphanWorktrees: reconcileOrphanWorktrees(set, get),
  };
};
