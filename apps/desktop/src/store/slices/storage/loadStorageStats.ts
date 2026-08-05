import {
  getDatabaseSizeBytes,
  getTurnEventStatsForSessions,
  listArchivedSessionRefs,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { collectArchivedWorktrees } from './collectArchivedWorktrees';
import type { GetFn, SetFn } from './types';

export const loadStorageStats = (set: SetFn, get: GetFn) => {
  return async () => {
    set({ storageStatsLoading: true });
    try {
      const refs = await listArchivedSessionRefs({ db: tauriDatabase });
      const [databaseBytes, transcripts, archivedWorktrees] = await Promise.all([
        getDatabaseSizeBytes({ db: tauriDatabase }),
        getTurnEventStatsForSessions({
          db: tauriDatabase,
          sessionIds: refs.map((ref) => ref.sessionId),
        }),
        collectArchivedWorktrees({ workspaces: get().workspaces }),
      ]);
      set({
        storageStats: {
          databaseBytes,
          archivedSessionCount: refs.length,
          archivedTranscriptRows: transcripts.rowCount,
          archivedTranscriptBytes: transcripts.payloadBytes,
          archivedWorktrees,
        },
        storageStatsLoading: false,
      });
    } catch (err) {
      set({ storageStatsLoading: false });
      throw err;
    }
  };
};
