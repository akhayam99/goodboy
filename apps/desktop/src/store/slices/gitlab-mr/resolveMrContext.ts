import type { GitlabWorkspaceIntegration, SessionId, WorkspaceId } from '@goodboy/types';
import { worktreeRemoteUrl } from '../../../features/worktree/worktree';
import { projectPathFromRemoteUrl } from '../../../shared/lib/remoteHost';
import type { GetFn } from './types';

export type MrContext = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly branch: string;
  readonly host: string;
  readonly projectPath: string;
  readonly goal: string;
};

export const resolveMrContext = async (
  get: GetFn,
  sessionId: SessionId,
): Promise<MrContext | null> => {
  const branch = get().sessionBranches[sessionId];
  const session = get().sessions.find((s) => s.id === sessionId);
  if (!branch || !session) {
    return null;
  }
  const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
  if (!workspace) {
    return null;
  }
  const integration = (get().workspaceIntegrations[session.workspaceId] ?? []).find(
    (i): i is GitlabWorkspaceIntegration => i.provider === 'gitlab',
  );
  if (!integration) {
    return null;
  }
  const remoteUrl = await worktreeRemoteUrl(workspace.rootPath);
  const projectPath = projectPathFromRemoteUrl(remoteUrl);
  if (!projectPath) {
    return null;
  }
  return {
    sessionId,
    workspaceId: session.workspaceId,
    rootPath: workspace.rootPath,
    branch,
    host: integration.config.host,
    projectPath,
    goal: session.goal,
  };
};
