import { upsertWorkspaceIntegration } from '@goodboy/db';
import type {
  BitbucketWorkspaceIntegration,
  IsoDateTime,
  WorkspaceId,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import {
  bitbucketConnect as bitbucketStoreToken,
  bitbucketValidateConnection,
  type BitbucketConnection,
} from '../../../features/integrations/bitbucket/client';
import { tauriDatabase } from '../../../shared/lib/db';
import { configFromBitbucketConnection } from './configFromBitbucketConnection';
import type { GetFn, SetFn } from './types';

type ConnectParams = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceSlug: string;
  readonly email: string;
  readonly apiToken: string;
};

export const connectBitbucket = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
    workspaceSlug,
    email,
    apiToken,
  }: ConnectParams): Promise<BitbucketConnection> => {
    const connection = await bitbucketValidateConnection({ workspaceSlug, email, apiToken });
    await bitbucketStoreToken({ workspaceId, apiToken });
    const now = new Date().toISOString() as IsoDateTime;
    const existing = get().workspaceIntegrations[workspaceId]?.find(
      (integration): integration is BitbucketWorkspaceIntegration =>
        integration.provider === 'bitbucket',
    );
    const integration: BitbucketWorkspaceIntegration = {
      id: (existing?.id ?? crypto.randomUUID()) as WorkspaceIntegrationId,
      workspaceId,
      provider: 'bitbucket',
      config: {
        ...(existing?.config ?? {}),
        ...configFromBitbucketConnection({ connection }),
        email,
      },
      credentialKey: `goodboy.workspace.${workspaceId}.bitbucket`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkspaceIntegration(tauriDatabase, integration);
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      const rest = current.filter((candidate) => candidate.provider !== 'bitbucket');
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: [...rest, integration],
        },
      };
    });
    return connection;
  };
};
