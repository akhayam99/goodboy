import { listDormantSessionTelemetry } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from '../../slice-types';

export const loadDormantSpend = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId): Promise<void> => {
    const entries = await listDormantSessionTelemetry({ db: tauriDatabase, workspaceId });
    if (get().currentWorkspaceId !== workspaceId) {
      return;
    }
    set({ dormantSpend: { workspaceId, entries } });
  };
};
