import type { SessionId } from '@goodboy/types';
import { listWorktreesForSession, updateSessionWorktreeBranch } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { getSessionRepo } from './getSessionRepo';
import type { GetFn, SetFn } from './types';

export const reconcileSessionBranch = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, observedBranch: string) => {
    if (isBranchlessSession({ branch: get().sessionBranches[sessionId] })) {
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
    set((state) => {
      const nextGithub = { ...state.sessionGithub };
      const nextSelectedPrNumber = { ...state.sessionSelectedPrNumber };
      delete nextGithub[sessionId];
      delete nextSelectedPrNumber[sessionId];
      const sessionPrMap = { ...state.sessionProjectPrs[sessionId] };
      delete sessionPrMap[repo.projectId];
      const nextProjectPrs = { ...state.sessionProjectPrs, [sessionId]: sessionPrMap };
      const mounts = state.sessionProjectMounts[sessionId] ?? [];
      const shouldUpdateSessionBranch = mounts[0]?.worktreePath === repo.worktreePath;
      const sessionProjectMounts = {
        ...state.sessionProjectMounts,
        [sessionId]: mounts.map((mount) =>
          mount.worktreePath === repo.worktreePath ? { ...mount, branch: trimmed } : mount,
        ),
      };
      return {
        sessionBranches: shouldUpdateSessionBranch
          ? { ...state.sessionBranches, [sessionId]: trimmed }
          : state.sessionBranches,
        sessionProjectMounts,
        sessionGithub: nextGithub,
        sessionProjectPrs: nextProjectPrs,
        sessionSelectedPrNumber: nextSelectedPrNumber,
      };
    });
  };
};
