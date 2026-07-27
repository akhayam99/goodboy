import type { SessionId } from '@goodboy/types';
import { listWorktreesForSession, updateSessionWorktreeBranch } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  changeWorktreeBranch,
  invalidateLocalBranchesCache,
} from '../../../features/worktree/worktree';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
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
    const primary = worktrees[0];
    if (!primary) {
      throw new Error(`no worktree found for session ${sessionId}`);
    }
    if (!workspace) {
      throw new Error('workspace not found for session');
    }
    await changeWorktreeBranch({
      repoPath: workspace.rootPath,
      worktreePath: primary.worktreePath,
      branch: target,
      createNew,
    });
    invalidateLocalBranchesCache(workspace.rootPath);
    await updateSessionWorktreeBranch(tauriDatabase, sessionId, primary.parallelIndex, target);
    set((state) => {
      const nextGithub = { ...state.sessionGithub };
      delete nextGithub[sessionId];
      return {
        sessionBranches: { ...state.sessionBranches, [sessionId]: target },
        sessionGithub: nextGithub,
      };
    });
  };
};
