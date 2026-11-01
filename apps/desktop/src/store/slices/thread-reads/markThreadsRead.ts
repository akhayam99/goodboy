import { markThreadsRead as markThreadsReadDb } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SliceDeps } from '../../slice-types';

type MarkParams = {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

export const markThreadsRead = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, threadIds }: MarkParams): Promise<boolean> => {
    if (threadIds.length === 0) {
      return true;
    }
    const readAt = Date.now();
    try {
      await markThreadsReadDb({ db: tauriDatabase, sessionId, threadIds, readAt });
    } catch (error) {
      void get().reportError({
        title: 'Could not save which comments you have seen',
        error,
        severity: 'warning',
      });
      return false;
    }
    set((state) => ({
      sessionThreadReads: {
        ...state.sessionThreadReads,
        [sessionId]: {
          ...state.sessionThreadReads[sessionId],
          ...Object.fromEntries(threadIds.map((threadId) => [threadId, readAt])),
        },
      },
    }));
    return true;
  };
};
