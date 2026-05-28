import { listIntegrationsForWorkspace } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

/** Hydrate integrations cache for a single workspace from the DB. */
export function loadIntegrations(set: SetFn) {
  return async (workspaceId: WorkspaceId) => {
    const rows = await listIntegrationsForWorkspace(tauriDatabase, workspaceId);
    set((state) => ({
      workspaceIntegrations: { ...state.workspaceIntegrations, [workspaceId]: rows },
    }));
  };
}
