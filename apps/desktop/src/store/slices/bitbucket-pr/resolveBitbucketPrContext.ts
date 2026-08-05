import type { BitbucketWorkspaceIntegration, SessionId } from '@goodboy/types';
import type { BitbucketRepo } from '../../../features/integrations/bitbucket/client';
import { worktreeRemoteUrl } from '../../../features/worktree/worktree';
import { projectPathFromRemoteUrl } from '../../../shared/lib/remoteHost';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { bitbucketRepoSlug } from './bitbucketRepoSlug';
import type { GetFn } from './types';

export type BitbucketPrContext = BitbucketRepo & {
  readonly sessionId: SessionId;
  readonly branch: string;
  readonly goal: string;
};

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const resolveBitbucketPrContext = async ({
  get,
  sessionId,
}: Params): Promise<BitbucketPrContext | null> => {
  const session = get().sessions.find((candidate) => candidate.id === sessionId) ?? null;
  const repo = getSessionRepo({ get, sessionId });
  if (session == null || repo == null || repo.branch === '') {
    return null;
  }
  const integration = (get().workspaceIntegrations[session.workspaceId] ?? []).find(
    (candidate): candidate is BitbucketWorkspaceIntegration => candidate.provider === 'bitbucket',
  );
  if (integration == null) {
    return null;
  }
  const remoteUrl = await worktreeRemoteUrl(repo.repoRoot);
  const repoSlug = bitbucketRepoSlug({ projectPath: projectPathFromRemoteUrl(remoteUrl) });
  if (repoSlug == null) {
    return null;
  }
  return {
    sessionId,
    workspaceId: session.workspaceId,
    workspaceSlug: integration.config.workspaceSlug,
    repoSlug,
    email: integration.config.email,
    branch: repo.branch,
    goal: session.goal,
  };
};
