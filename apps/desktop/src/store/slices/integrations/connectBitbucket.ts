import type {
  BitbucketIntegrationBinding,
  IntegrationCredentialId,
  WorkspaceId,
} from '@goodboy/types';
import {
  bitbucketConnect,
  bitbucketValidateConnection,
  type BitbucketConnection,
} from '../../../features/integrations/bitbucket/client';
import { commitIntegrationConnection } from './commitIntegrationConnection';
import { configFromBitbucketConnection } from './configFromBitbucketConnection';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceSlug: string;
  readonly email: string;
  readonly apiToken: string | null;
  readonly credentialId: IntegrationCredentialId | null;
};

export const connectBitbucket = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
    workspaceSlug,
    email,
    apiToken,
    credentialId,
  }: Params): Promise<BitbucketConnection> => {
    const chosen = credentialId ?? (crypto.randomUUID() as IntegrationCredentialId);
    const supplied = credentialId === null ? apiToken : null;
    const connection = await bitbucketValidateConnection({
      credentialId: chosen,
      workspaceSlug,
      email,
      apiToken: supplied,
    });
    const existing = get().workspaceIntegrations[workspaceId]?.find(
      (integration): integration is BitbucketIntegrationBinding =>
        integration.provider === 'bitbucket',
    );
    await commitIntegrationConnection({
      set,
      workspaceId,
      provider: 'bitbucket',
      credentialId: chosen,
      config: {
        ...(existing?.config ?? {}),
        ...configFromBitbucketConnection({ connection }),
        email,
      },
      newCredential:
        credentialId === null
          ? { label: connection.user.displayName ?? email, account: email }
          : null,
      storeSecret: () => bitbucketConnect({ credentialId: chosen, apiToken: supplied }),
    });
    return connection;
  };
};
