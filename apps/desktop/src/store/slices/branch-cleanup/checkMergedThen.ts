import { branchMergeState } from '../../../features/worktree/worktree';
import type { CheckMergedThenParams, GetFn, SetFn } from './types';

const inFlight = new Set<string>();

export const checkMergedThen = (set: SetFn, get: GetFn) => {
  return async ({
    mountId,
    repoRoot,
    branch,
    baseBranch,
    head,
    mergedHead,
  }: CheckMergedThenParams): Promise<void> => {
    const known = get().mergedThen[mountId];
    if (known !== undefined && known.head === head && known.mergedHead === mergedHead) {
      return;
    }
    const key = `${mountId}:${head}:${mergedHead}`;
    if (inFlight.has(key)) {
      return;
    }
    inFlight.add(key);
    try {
      const state = await branchMergeState({
        repoPath: repoRoot,
        branch,
        base: baseBranch,
        mergedHead,
      }).catch(() => null);
      if (state === null || (state.kind !== 'merged-then' && state.kind !== 'merged-via-pr')) {
        return;
      }
      const newCommits = state.kind === 'merged-then' ? state.newCommits : 0;
      set((current) => ({
        mergedThen: { ...current.mergedThen, [mountId]: { head, mergedHead, newCommits } },
      }));
    } finally {
      inFlight.delete(key);
    }
  };
};
