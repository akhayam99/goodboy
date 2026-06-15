import { upsertWorkspaceIntegration } from '@goodboy/db';
import type {
  GitlabWorkspaceIntegration,
  IsoDateTime,
  WorkspaceId,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import { gitlabConnect, type GitlabUser } from '../../../features/integrations/gitlab/client';
import { tauriDatabase } from '../../../shared/lib/db';
import { configFromGitlabUser } from './configFromGitlabUser';
import type { GetFn, SetFn } from './types';

export const connectGitlab = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId, host: string, token: string): Promise<GitlabUser> => {
    const user = await gitlabConnect(workspaceId, host, token);
    const now = new Date().toISOString() as IsoDateTime;
    const existing = get().workspaceIntegrations[workspaceId]?.find(
      (i): i is GitlabWorkspaceIntegration => i.provider === 'gitlab',
    );
    const integration: GitlabWorkspaceIntegration = {
      id: (existing?.id ?? crypto.randomUUID()) as WorkspaceIntegrationId,
      workspaceId,
      provider: 'gitlab',
      config: { ...(existing?.config ?? {}), ...configFromGitlabUser(user), host },
      credentialKey: `goodboy.workspace.${workspaceId}.gitlab`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkspaceIntegration(tauriDatabase, integration);
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      const rest = current.filter((i) => i.provider !== 'gitlab');
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: [...rest, integration],
        },
      };
    });
    return user;
  };
};
