import { deleteWorkspaceIntegration as deleteIntegrationInDb } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { bitbucketDisconnect } from '../../../features/integrations/bitbucket/client';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type DisconnectParams = {
  readonly workspaceId: WorkspaceId;
};

export const disconnectBitbucket = (set: SetFn) => {
  return async ({ workspaceId }: DisconnectParams): Promise<void> => {
    await bitbucketDisconnect({ workspaceId });
    await deleteIntegrationInDb(tauriDatabase, workspaceId, 'bitbucket');
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: current.filter((integration) => integration.provider !== 'bitbucket'),
        },
      };
    });
  };
};
