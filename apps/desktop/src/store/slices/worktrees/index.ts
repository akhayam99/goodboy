import { changeSessionBranch } from './changeSessionBranch';
import { reconcileSessionBranch } from './reconcileSessionBranch';
import type { GetFn, SetFn } from './types';

export function createWorktreesSlice(set: SetFn, get: GetFn) {
  return {
    changeSessionBranch: changeSessionBranch(set, get),
    reconcileSessionBranch: reconcileSessionBranch(set, get),
  };
}
