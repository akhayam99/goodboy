import { amendSessionCommit } from './amendSessionCommit';
import { changeSessionBranch } from './changeSessionBranch';
import { reconcileSessionBranch } from './reconcileSessionBranch';
import { squashSessionCommits } from './squashSessionCommits';
import type { GetFn, SetFn } from './types';

export const createWorktreesSlice = (set: SetFn, get: GetFn) => {
  return {
    changeSessionBranch: changeSessionBranch(set, get),
    reconcileSessionBranch: reconcileSessionBranch(set, get),
    amendSessionCommit: amendSessionCommit(set, get),
    squashSessionCommits: squashSessionCommits(set, get),
  };
};
