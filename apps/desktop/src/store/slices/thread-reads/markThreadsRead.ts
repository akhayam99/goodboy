import { markThreadsRead as markThreadsReadDb } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SliceDeps } from '../../slice-types';

export type ThreadReadMark = {
  readonly threadId: string;
  readonly readAt: number;
};

type MarkParams = {
  readonly sessionId: SessionId;
  readonly marks: ReadonlyArray<ThreadReadMark>;
};

export const markThreadsRead = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, marks }: MarkParams): Promise<boolean> => {
    if (marks.length === 0) {
      return true;
    }
    try {
      await markThreadsReadDb({ db: tauriDatabase, sessionId, marks });
    } catch (error) {
      void get().reportError({
        title: 'Could not save which comments you have seen',
        error,
        severity: 'warning',
      });
      return false;
    }
    set((state) => {
      const current = state.sessionThreadReads[sessionId];
      if (current === undefined) {
        return state;
      }
      const merged = { ...current };
      for (const { threadId, readAt } of marks) {
        merged[threadId] = Math.max(merged[threadId] ?? 0, readAt);
      }
      return { sessionThreadReads: { ...state.sessionThreadReads, [sessionId]: merged } };
    });
    return true;
  };
};
