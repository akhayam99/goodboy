import type {
  IntegrationCredentialId,
  JiraWorkspaceIntegration,
  WorkspaceId,
} from '@goodboy/types';
import {
  jiraConnect,
  jiraValidateConnection,
  type JiraUser,
} from '../../../features/integrations/jira/client';
import { commitIntegrationConnection } from './commitIntegrationConnection';
import { configFromJiraUser } from './configFromJiraUser';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly siteUrl: string;
  readonly email: string;
  readonly projectKey: string;
  readonly apiToken: string | null;
  readonly credentialId: IntegrationCredentialId | null;
};

export const connectJira = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
    siteUrl,
    email,
    projectKey,
    apiToken,
    credentialId,
  }: Params): Promise<JiraUser> => {
    const chosen = credentialId ?? (crypto.randomUUID() as IntegrationCredentialId);
    const supplied = credentialId === null ? apiToken : null;
    const user = await jiraValidateConnection({
      credentialId: chosen,
      siteUrl,
      email,
      apiToken: supplied,
    });
    const existing = get().workspaceIntegrations[workspaceId]?.find(
      (integration): integration is JiraWorkspaceIntegration => integration.provider === 'jira',
    );
    await commitIntegrationConnection({
      set,
      workspaceId,
      provider: 'jira',
      credentialId: chosen,
      config: {
        ...(existing?.config ?? {}),
        ...configFromJiraUser({ user }),
        siteUrl,
        email,
        projectKey,
      },
      newCredential:
        credentialId === null ? { label: user.displayName ?? email, account: email } : null,
      storeSecret: () => jiraConnect({ credentialId: chosen, apiToken: supplied }),
    });
    return user;
  };
};
