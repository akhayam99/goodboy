import { deleteWorkspaceIntegration as deleteIntegrationInDb } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { jiraDisconnect } from '../../../features/integrations/jira/client';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export function disconnectJira(set: SetFn) {
  return async (workspaceId: WorkspaceId) => {
    await jiraDisconnect(workspaceId);
    await deleteIntegrationInDb(tauriDatabase, workspaceId, 'jira');
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: current.filter((i) => i.provider !== 'jira'),
        },
      };
    });
  };
}
