import type { SessionId } from '@goodboy/types';
import { listWorktreesForSession, updateSessionWorktreeBranch } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
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
    if (get().sessionBranches[sessionId] === trimmed) {
      return;
    }
    const repo = getSessionRepo({ get, sessionId });
    if (repo == null) {
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
    set((state) => {
      const nextGithub = { ...state.sessionGithub };
      delete nextGithub[sessionId];
      const mounts = state.sessionMounts[sessionId] ?? [];
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
        sessionBranches: { ...state.sessionBranches, [sessionId]: trimmed },
        sessionMounts,
        sessionGithub: nextGithub,
      };
    });
  };
};
