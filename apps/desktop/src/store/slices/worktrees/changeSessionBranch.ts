import type { SessionId } from '@goodboy/types';
import { listWorktreesForSession, updateSessionWorktreeBranch } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  changeWorktreeBranch,
  invalidateLocalBranchesCache,
} from '../../../features/worktree/worktree';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { announceSessionBranchChange } from './announceSessionBranchChange';
import { getSessionRepo } from './getSessionRepo';
import type { GetFn, SetFn } from './types';

type Args = {
  branch: string;
  createNew: boolean;
};

export const changeSessionBranch = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, { branch, createNew }: Args) => {
    if (isBranchlessSession({ branch: get().sessionBranches[sessionId] })) {
      return;
    }
    const target = branch.trim();
    if (!target) {
      throw new Error('branch name cannot be empty');
    }
    const worktrees = await listWorktreesForSession(tauriDatabase, sessionId);
    if (worktrees.length === 0) {
      throw new Error(`no worktree found for session ${sessionId}`);
    }
    const repo = getSessionRepo({ get, sessionId });
    if (repo === null) {
      throw new Error(`no worktree found for session ${sessionId}`);
    }
    const changedWorktree =
      worktrees.find((candidate) => candidate.worktreePath === repo.worktreePath) ?? null;
    if (changedWorktree == null) {
      throw new Error(`no worktree found for session ${sessionId}`);
    }
    const repoRoot = repo.repoRoot;
    const worktreePath = repo.worktreePath;
    await changeWorktreeBranch({
      repoPath: repoRoot,
      worktreePath,
      branch: target,
      createNew,
    });
    invalidateLocalBranchesCache(repoRoot);
    await updateSessionWorktreeBranch(
      tauriDatabase,
      sessionId,
      changedWorktree.parallelIndex,
      target,
    );
    const previousBranch = changedWorktree.branch;
    set((state) => {
      const nextGithub = { ...state.sessionGithub };
      const nextSelectedPrNumber = { ...state.sessionSelectedPrNumber };
      delete nextGithub[sessionId];
      delete nextSelectedPrNumber[sessionId];
      const sessionPrMap = { ...state.sessionProjectPrs[sessionId] };
      delete sessionPrMap[repo.projectId];
      const nextProjectPrs = { ...state.sessionProjectPrs, [sessionId]: sessionPrMap };
      const mounts = state.sessionProjectMounts[sessionId] ?? [];
      const shouldUpdateSessionBranch = mounts[0]?.worktreePath === worktreePath;
      const sessionProjectMounts = {
        ...state.sessionProjectMounts,
        [sessionId]: mounts.map((mount) =>
          mount.worktreePath === worktreePath ? { ...mount, branch: target } : mount,
        ),
      };
      return {
        sessionBranches: shouldUpdateSessionBranch
          ? { ...state.sessionBranches, [sessionId]: target }
          : state.sessionBranches,
        sessionProjectMounts,
        sessionGithub: nextGithub,
        sessionProjectPrs: nextProjectPrs,
        sessionSelectedPrNumber: nextSelectedPrNumber,
      };
    });
    await get().recordSessionEvent({
      sessionId,
      kind: 'branch_switched',
      payload: { from: previousBranch, to: target },
    });
    await announceSessionBranchChange({
      get,
      sessionId,
      fromBranch: previousBranch,
      toBranch: target,
    });
  };
};
