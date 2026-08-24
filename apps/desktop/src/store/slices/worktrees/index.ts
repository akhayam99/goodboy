import { amendSessionCommit } from './amendSessionCommit';
import { changeSessionBranch } from './changeSessionBranch';
import { reconcileOrphanWorktrees } from './reconcileOrphanWorktrees';
import { reconcileSessionBranch } from './reconcileSessionBranch';
import { removeOrphanWorktrees } from './removeOrphanWorktrees';
import { setSessionActiveProject } from './setSessionActiveProject';
import { squashSessionCommits } from './squashSessionCommits';
import type { GetFn, SetFn } from './types';

export const createWorktreesSlice = (set: SetFn, get: GetFn) => {
  return {
    changeSessionBranch: changeSessionBranch(set, get),
    reconcileSessionBranch: reconcileSessionBranch(set, get),
    reconcileOrphanWorktrees: reconcileOrphanWorktrees(set, get),
    removeOrphanWorktrees: removeOrphanWorktrees(set, get),
    setSessionActiveProject: setSessionActiveProject({ set, get }),
    amendSessionCommit: amendSessionCommit(set, get),
    squashSessionCommits: squashSessionCommits(set, get),
  };
};
