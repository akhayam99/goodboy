import { upsertWorkspaceIntegration } from '@goodboy/db';
import type {
  IsoDateTime,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import { jiraConnect, type JiraSelf } from '../../../features/integrations/jira/client';
import { tauriDatabase } from '../../../shared/lib/db';
import { configFromSelf } from './configFromSelf';
import type { GetFn, SetFn } from './types';

export function connectJira(set: SetFn, get: GetFn) {
  return async (
    workspaceId: WorkspaceId,
    siteUrl: string,
    email: string,
    token: string,
  ): Promise<JiraSelf> => {
    const self = await jiraConnect(workspaceId, siteUrl, email, token);
    const now = new Date().toISOString() as IsoDateTime;
    const existing = get().workspaceIntegrations[workspaceId]?.find((i) => i.provider === 'jira');
    const integration: WorkspaceIntegration = {
      id: (existing?.id ?? crypto.randomUUID()) as WorkspaceIntegrationId,
      workspaceId,
      provider: 'jira',
      config: configFromSelf(self, siteUrl),
      credentialKey: `goodboy.workspace.${workspaceId}.jira`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkspaceIntegration(tauriDatabase, integration);
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      const rest = current.filter((i) => i.provider !== 'jira');
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: [...rest, integration],
        },
      };
    });
    return self;
  };
}
