import { listThreadReads } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';

type LoadParams = {
  readonly sessionId: SessionId;
};

export const loadThreadReads = ({ set, get }: SliceDeps) => {
  const latest = createLatestOnly();
  return async ({ sessionId }: LoadParams): Promise<void> => {
    try {
      await latest.run({
        key: sessionId,
        request: async () => ({ reads: await listThreadReads({ db: tauriDatabase, sessionId }) }),
        apply: ({ reads }) => {
          set((state) => {
            const merged = { ...state.sessionThreadReads[sessionId] };
            for (const { threadId, readAt } of reads) {
              merged[threadId] = Math.max(merged[threadId] ?? 0, readAt);
            }
            return { sessionThreadReads: { ...state.sessionThreadReads, [sessionId]: merged } };
          });
        },
      });
    } catch (error) {
      void get().reportError({
        title: 'Could not read which comments you have seen',
        error,
        severity: 'warning',
      });
    }
  };
};
