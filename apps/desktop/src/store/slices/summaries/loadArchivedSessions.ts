import type { WorkspaceId } from '@goodboy/types';
import { listArchivedSessionsForWorkspace } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadArchivedSessions = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const archived = await listArchivedSessionsForWorkspace(tauriDatabase, workspaceId);
    set((state) => ({
      archivedSessions: { ...state.archivedSessions, [workspaceId]: archived },
    }));
  };
};
