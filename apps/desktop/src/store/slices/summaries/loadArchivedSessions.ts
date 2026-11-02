import type { WorkspaceId } from '@goodboy/types';
import { listArchivedSessionsForWorkspace } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { switchEpoch } from '../workspaces/switchEpoch';
import { archivedCacheVersion } from './archivedCacheVersion';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly isForced?: boolean;
};

export const loadArchivedSessions = (set: SetFn, get: GetFn) => {
  const inFlight = new Map<WorkspaceId, Promise<void>>();
  const loadedAtEpoch = new Map<WorkspaceId, number>();
  return async ({ workspaceId, isForced = false }: Params): Promise<void> => {
    const isLoaded =
      loadedAtEpoch.get(workspaceId) === switchEpoch.value &&
      get().archivedSessions[workspaceId] !== undefined;
    if (!isForced && isLoaded) {
      return;
    }
    const pending = inFlight.get(workspaceId);
    if (pending !== undefined) {
      return pending;
    }
    const epoch = switchEpoch.value;
    const version = archivedCacheVersion({ workspaceId });
    const request = (async () => {
      try {
        const archived = await listArchivedSessionsForWorkspace(tauriDatabase, workspaceId);
        if (archivedCacheVersion({ workspaceId }) !== version) {
          return;
        }
        set((state) => ({
          archivedSessions: { ...state.archivedSessions, [workspaceId]: archived },
        }));
        loadedAtEpoch.set(workspaceId, epoch);
      } finally {
        inFlight.delete(workspaceId);
      }
    })();
    inFlight.set(workspaceId, request);
    return request;
  };
};
