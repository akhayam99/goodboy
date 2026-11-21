import { listTurnFileSets } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';
import type { TurnFilesEntry } from './types';

type Params = {
  readonly sessionId: SessionId;
};

const latest = createLatestOnly();

export const loadTurnFiles = ({ set }: SliceDeps) => {
  return async ({ sessionId }: Params): Promise<void> => {
    let entries: ReadonlyArray<TurnFilesEntry> = [];
    await latest.run({
      key: sessionId,
      request: async () => {
        const sets = await listTurnFileSets({ db: tauriDatabase, sessionId });
        entries = sets.map((entry) => ({
          mountId: entry.mountId,
          paths: entry.own.map((file) => file.path),
          recordedAtMs: entry.recordedAtMs,
        }));
      },
      apply: () => {
        set((state) => ({ turnFiles: { ...state.turnFiles, [sessionId]: entries } }));
      },
    });
  };
};
