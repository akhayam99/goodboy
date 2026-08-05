import { deleteWorkspaceIntegration as deleteIntegrationInDb } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { slackDisconnect } from '../../../features/integrations/slack/client';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type DisconnectParams = {
  readonly workspaceId: WorkspaceId;
};

export const disconnectSlack = (set: SetFn) => {
  return async ({ workspaceId }: DisconnectParams): Promise<void> => {
    await slackDisconnect({ workspaceId });
    await deleteIntegrationInDb(tauriDatabase, workspaceId, 'slack');
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: current.filter((integration) => integration.provider !== 'slack'),
        },
      };
    });
  };
};
