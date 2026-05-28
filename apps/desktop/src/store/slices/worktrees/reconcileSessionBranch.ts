import type { SessionId } from '@goodboy/types';
import { listWorktreesForSession, updateSessionWorktreeBranch } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export function reconcileSessionBranch(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, observedBranch: string) => {
    // Catch the branch cache up to git reality. changeSessionBranch keeps DB +
    // store in sync, but an agent running `git switch` directly in the worktree
    // shell bypasses it, HEAD moves while sessionBranches stays frozen.
    const trimmed = observedBranch.trim();
    if (!trimmed) return;
    if (get().sessionBranches[sessionId] === trimmed) return;
    const worktrees = await listWorktreesForSession(tauriDatabase, sessionId);
    const primary = worktrees[0];
    if (!primary) return;
    if (primary.branch !== trimmed) {
      await updateSessionWorktreeBranch(tauriDatabase, sessionId, primary.parallelIndex, trimmed);
    }
    set((state) => {
      // Branch moved → drop the stale PR cache so the ContextPanel effect
      // refetches for the new branch (same as changeSessionBranch).
      const nextGithub = { ...state.sessionGithub };
      delete nextGithub[sessionId];
      return {
        sessionBranches: { ...state.sessionBranches, [sessionId]: trimmed },
        sessionGithub: nextGithub,
      };
    });
  };
}
