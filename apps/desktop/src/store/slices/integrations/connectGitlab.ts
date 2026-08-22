import type {
  GitlabIntegrationBinding,
  IntegrationCredentialId,
  WorkspaceId,
} from '@goodboy/types';
import {
  gitlabConnect,
  gitlabValidateConnection,
  type GitlabUser,
} from '../../../features/integrations/gitlab/client';
import { commitIntegrationConnection } from './commitIntegrationConnection';
import { configFromGitlabUser } from './configFromGitlabUser';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly host: string;
  readonly token: string | null;
  readonly credentialId: IntegrationCredentialId | null;
};

export const connectGitlab = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, host, token, credentialId }: Params): Promise<GitlabUser> => {
    const chosen = credentialId ?? (crypto.randomUUID() as IntegrationCredentialId);
    const supplied = credentialId === null ? token : null;
    const user = await gitlabValidateConnection(chosen, host, supplied);
    const existing = get().workspaceIntegrations[workspaceId]?.find(
      (integration): integration is GitlabIntegrationBinding => integration.provider === 'gitlab',
    );
    await commitIntegrationConnection({
      set,
      workspaceId,
      provider: 'gitlab',
      credentialId: chosen,
      config: { ...(existing?.config ?? {}), ...configFromGitlabUser(user), host },
      newCredential: credentialId === null ? { label: user.name, account: host } : null,
      storeSecret: () => gitlabConnect(chosen, supplied),
    });
    return user;
  };
};
