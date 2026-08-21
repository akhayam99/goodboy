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
    const target = branch.trim();
    if (!target) {
      throw new Error('branch name cannot be empty');
    }
    const worktrees = await listWorktreesForSession(tauriDatabase, sessionId);
    if (worktrees.length === 0) {
      throw new Error(`no worktree found for session ${sessionId}`);
    }
    if (!workspace) {
      throw new Error('workspace not found for session');
    }
    const isComposite = workspace.kind === 'composite';
    const repo = isComposite ? getSessionRepo({ get, sessionId }) : null;
    if (isComposite && repo == null) {
      throw new Error(`no worktree found for session ${sessionId}`);
    }
    const changedWorktree =
      repo == null
        ? worktrees[0]
        : (worktrees.find((candidate) => candidate.worktreePath === repo.worktreePath) ?? null);
    if (changedWorktree == null) {
      throw new Error(`no worktree found for session ${sessionId}`);
    }
    const repoRoot = repo?.repoRoot ?? workspace.rootPath;
    const worktreePath = repo?.worktreePath ?? changedWorktree.worktreePath;
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
      const nextGithubPrs = { ...state.sessionGithubPrs };
      const nextSelectedPrNumber = { ...state.sessionSelectedPrNumber };
      delete nextGithub[sessionId];
      delete nextGithubPrs[sessionId];
      delete nextSelectedPrNumber[sessionId];
      const mounts = state.sessionMounts[sessionId] ?? [];
      const shouldUpdateSessionBranch =
        workspace.kind !== 'composite' || mounts[0]?.worktreePath === worktreePath;
      const sessionMounts =
        workspace.kind === 'composite'
          ? {
              ...state.sessionMounts,
              [sessionId]: mounts.map((mount) =>
                mount.worktreePath === worktreePath ? { ...mount, branch: target } : mount,
              ),
            }
          : state.sessionMounts;
      return {
        sessionBranches: shouldUpdateSessionBranch
          ? { ...state.sessionBranches, [sessionId]: target }
          : state.sessionBranches,
        sessionMounts,
        sessionGithub: nextGithub,
        sessionGithubPrs: nextGithubPrs,
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
