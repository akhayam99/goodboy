import { listIntegrationBindingsForWorkspace } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const loadIntegrations = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const rows = await listIntegrationBindingsForWorkspace({ db: tauriDatabase, workspaceId });
    set((state) => ({
      workspaceIntegrations: { ...state.workspaceIntegrations, [workspaceId]: rows },
    }));
    void get().refreshViewerIdentity({ workspaceId });
  };
};
