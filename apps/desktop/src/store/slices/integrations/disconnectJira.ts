import { deleteWorkspaceIntegration as deleteIntegrationInDb } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { jiraDisconnect } from '../../../features/integrations/jira/client';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type DisconnectParams = {
  readonly workspaceId: WorkspaceId;
};

export const disconnectJira = (set: SetFn) => {
  return async ({ workspaceId }: DisconnectParams): Promise<void> => {
    await jiraDisconnect({ workspaceId });
    await deleteIntegrationInDb(tauriDatabase, workspaceId, 'jira');
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: current.filter((integration) => integration.provider !== 'jira'),
        },
      };
    });
  };
};
