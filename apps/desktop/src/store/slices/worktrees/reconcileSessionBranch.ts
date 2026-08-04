import type { SessionId } from '@goodboy/types';
import { listWorktreesForSession, updateSessionWorktreeBranch } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { announceSessionBranchChange } from './announceSessionBranchChange';
import { getSessionRepo } from './getSessionRepo';
import type { GetFn, SetFn } from './types';

export const reconcileSessionBranch = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, observedBranch: string) => {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const workspace = session
      ? get().workspaces.find((candidate) => candidate.id === session.workspaceId)
      : null;
    if (
      isBranchlessSession({
        workspaceKind: workspace?.kind,
        branch: get().sessionBranches[sessionId],
      })
    ) {
      return;
    }
    const trimmed = observedBranch.trim();
    if (!trimmed) {
      return;
    }
    const repo = getSessionRepo({ get, sessionId });
    if (repo == null) {
      return;
    }
    if (repo.branch === trimmed) {
      return;
    }
    const worktrees = await listWorktreesForSession(tauriDatabase, sessionId);
    const changedWorktree = worktrees.find(
      (candidate) => candidate.worktreePath === repo.worktreePath,
    );
    if (changedWorktree == null) {
      return;
    }
    if (changedWorktree.branch !== trimmed) {
      await updateSessionWorktreeBranch(
        tauriDatabase,
        sessionId,
        changedWorktree.parallelIndex,
        trimmed,
      );
    }
    const previousBranch = repo.branch;
    set((state) => {
      const nextGithub = { ...state.sessionGithub };
      const nextGithubPrs = { ...state.sessionGithubPrs };
      const nextSelectedPrNumber = { ...state.sessionSelectedPrNumber };
      delete nextGithub[sessionId];
      delete nextGithubPrs[sessionId];
      delete nextSelectedPrNumber[sessionId];
      const mounts = state.sessionMounts[sessionId] ?? [];
      const shouldUpdateSessionBranch =
        workspace?.kind !== 'composite' || mounts[0]?.worktreePath === repo.worktreePath;
      const sessionMounts =
        workspace?.kind === 'composite'
          ? {
              ...state.sessionMounts,
              [sessionId]: mounts.map((mount) =>
                mount.worktreePath === repo.worktreePath ? { ...mount, branch: trimmed } : mount,
              ),
            }
          : state.sessionMounts;
      return {
        sessionBranches: shouldUpdateSessionBranch
          ? { ...state.sessionBranches, [sessionId]: trimmed }
          : state.sessionBranches,
        sessionMounts,
        sessionGithub: nextGithub,
        sessionGithubPrs: nextGithubPrs,
        sessionSelectedPrNumber: nextSelectedPrNumber,
      };
    });
    await announceSessionBranchChange({
      get,
      sessionId,
      fromBranch: previousBranch,
      toBranch: trimmed,
    });
  };
};
