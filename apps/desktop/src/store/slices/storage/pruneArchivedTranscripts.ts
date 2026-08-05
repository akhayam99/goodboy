import { deleteTurnEventsForSessions, listArchivedSessionRefs, vacuumDatabase } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const pruneArchivedTranscripts = (_set: SetFn, get: GetFn) => {
  return async (): Promise<number> => {
    const refs = await listArchivedSessionRefs({ db: tauriDatabase });
    if (refs.length === 0) {
      await get().loadStorageStats();
      return 0;
    }
    const deleted = await deleteTurnEventsForSessions({
      db: tauriDatabase,
      sessionIds: refs.map((ref) => ref.sessionId),
    });
    await vacuumDatabase({ db: tauriDatabase });
    await get().loadStorageStats();
    return deleted;
  };
};
