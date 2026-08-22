import type { GitlabIntegrationBinding, SessionId, WorkspaceId } from '@goodboy/types';
import { worktreeRemoteUrl } from '../../../features/worktree/worktree';
import { projectPathFromRemoteUrl } from '../../../shared/lib/remoteHost';
import { getSessionRepo } from '../worktrees/getSessionRepo';
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
  const session = get().sessions.find((s) => s.id === sessionId);
  const repo = getSessionRepo({ get, sessionId });
  if (repo == null || repo.branch.length === 0 || !session) {
    return null;
  }
  const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
  if (!workspace) {
    return null;
  }
  const integration = (get().workspaceIntegrations[session.workspaceId] ?? []).find(
    (i): i is GitlabIntegrationBinding => i.provider === 'gitlab',
  );
  if (!integration) {
    return null;
  }
  const remoteUrl = await worktreeRemoteUrl(repo.repoRoot);
  const projectPath = projectPathFromRemoteUrl(remoteUrl);
  if (!projectPath) {
    return null;
  }
  return {
    sessionId,
    workspaceId: session.workspaceId,
    rootPath: repo.repoRoot,
    branch: repo.branch,
    host: integration.config.host,
    projectPath,
    goal: session.goal,
  };
};
