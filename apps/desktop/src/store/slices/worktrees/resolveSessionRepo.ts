import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../types';

export type SessionRepo = Readonly<{
  repoRoot: string;
  worktreePath: string;
  branch: string;
  mountName: string | null;
  workspaceId: WorkspaceId;
}>;

type State = Pick<
  AppState,
  | 'sessions'
  | 'workspaces'
  | 'sessionMounts'
  | 'sessionActiveMount'
  | 'sessionWorktrees'
  | 'sessionBranches'
>;

type ResolveParams = {
  readonly state: State;
  readonly sessionId: SessionId;
};

export const resolveSessionRepo = ({ state, sessionId }: ResolveParams): SessionRepo | null => {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session == null) {
    return null;
  }
  const workspace = state.workspaces.find((candidate) => candidate.id === session.workspaceId);
  if (workspace == null) {
    return null;
  }
  if (workspace.kind === 'simple') {
    return null;
  }
  if (workspace.kind === 'composite') {
    const mounts = state.sessionMounts[sessionId] ?? [];
    if (mounts.length === 0) {
      return null;
    }
    const activeWorkspaceId = state.sessionActiveMount[sessionId];
    const active =
      mounts.find((mount) => mount.workspaceId === activeWorkspaceId) ?? mounts[0] ?? null;
    if (active == null) {
      return null;
    }
    return {
      repoRoot: active.repoRoot,
      worktreePath: active.worktreePath,
      branch: active.branch,
      mountName: active.mountName,
      workspaceId: active.workspaceId,
    };
  }
  const worktreePath = state.sessionWorktrees[sessionId]?.[0];
  if (worktreePath == null) {
    return null;
  }
  return {
    repoRoot: workspace.rootPath,
    worktreePath,
    branch: state.sessionBranches[sessionId] ?? '',
    mountName: null,
    workspaceId: workspace.id,
  };
};
