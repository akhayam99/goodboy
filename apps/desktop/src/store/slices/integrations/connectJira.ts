import { upsertWorkspaceIntegration } from '@goodboy/db';
import type {
  IsoDateTime,
  JiraWorkspaceIntegration,
  WorkspaceId,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import { jiraValidateConnection, type JiraUser } from '../../../features/integrations/jira/client';
import { tauriDatabase } from '../../../shared/lib/db';
import { configFromJiraUser } from './configFromJiraUser';
import type { GetFn, SetFn } from './types';

type ConnectParams = {
  readonly workspaceId: WorkspaceId;
  readonly siteUrl: string;
  readonly email: string;
  readonly projectKey: string;
  readonly apiToken: string;
};

export const connectJira = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
    siteUrl,
    email,
    projectKey,
    apiToken,
  }: ConnectParams): Promise<JiraUser> => {
    const user = await jiraValidateConnection({ workspaceId, siteUrl, email, apiToken });
    const now = new Date().toISOString() as IsoDateTime;
    const existing = get().workspaceIntegrations[workspaceId]?.find(
      (integration): integration is JiraWorkspaceIntegration => integration.provider === 'jira',
    );
    const integration: JiraWorkspaceIntegration = {
      id: (existing?.id ?? crypto.randomUUID()) as WorkspaceIntegrationId,
      workspaceId,
      provider: 'jira',
      config: {
        ...(existing?.config ?? {}),
        ...configFromJiraUser({ user }),
        siteUrl,
        email,
        projectKey,
      },
      credentialKey: `goodboy.workspace.${workspaceId}.jira`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkspaceIntegration(tauriDatabase, integration);
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      const rest = current.filter((candidate) => candidate.provider !== 'jira');
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
