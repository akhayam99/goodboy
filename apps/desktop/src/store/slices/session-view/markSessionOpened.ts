import type { IsoDateTime, Session, SessionId } from '@goodboy/types';
import { markSessionOpened as dbMarkSessionOpened } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
};

export const markSessionOpened = (set: SetFn) => {
  return ({ sessionId }: Params): void => {
    const openedAt = new Date().toISOString() as IsoDateTime;
    const stamp = (session: Session): Session =>
      session.id === sessionId ? { ...session, lastOpenedAt: openedAt } : session;
    set((state) => {
      const isArchived = Object.values(state.archivedSessions).some((sessions) =>
        sessions.some((session) => session.id === sessionId),
      );
      return {
        sessions: state.sessions.map(stamp),
        ...(isArchived && {
          archivedSessions: Object.fromEntries(
            Object.entries(state.archivedSessions).map(([workspaceId, sessions]) => [
              workspaceId,
              sessions.map(stamp),
            ]),
          ),
        }),
      };
    });
    const persist = async (): Promise<void> => {
      try {
        await dbMarkSessionOpened({ db: tauriDatabase, id: sessionId, openedAt });
      } catch {
        return;
      }
    };
    void persist();
  };
};
