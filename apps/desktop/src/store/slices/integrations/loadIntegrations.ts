import { listIntegrationBindingsForWorkspace } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadIntegrations = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const rows = await listIntegrationBindingsForWorkspace({ db: tauriDatabase, workspaceId });
    set((state) => ({
      workspaceIntegrations: { ...state.workspaceIntegrations, [workspaceId]: rows },
    }));
  };
};
