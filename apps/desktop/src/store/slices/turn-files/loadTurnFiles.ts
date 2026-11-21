import { listTurnFileSets } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly sessionId: SessionId;
};

export const loadTurnFiles = ({ set }: SliceDeps) => {
  return async ({ sessionId }: Params): Promise<void> => {
    const sets = await listTurnFileSets({ db: tauriDatabase, sessionId });
    set((state) => ({
      turnFiles: {
        ...state.turnFiles,
        [sessionId]: sets.map((entry) => ({
          mountId: entry.mountId,
          paths: entry.own.map((file) => file.path),
          recordedAtMs: entry.recordedAtMs,
        })),
      },
    }));
  };
};
