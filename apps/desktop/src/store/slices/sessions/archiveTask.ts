import type { IsoDateTime, Session, SessionId } from '@goodboy/types';
import { archiveSession as archiveSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { dropPendingTurnEvents } from '../transcripts/buffer';
import type { GetFn, SetFn } from './types';
import { sessionById } from './sessionIndex';

export const archiveTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const prev = sessionById(get().sessions, sessionId);
    if (!prev) {
      return;
    }
    const nowIso = new Date().toISOString() as IsoDateTime;
    const archived: Session = { ...prev, archivedAt: nowIso };
    const workspaceId = prev.workspaceId;
    const isCurrent = get().currentSessionId === sessionId;

    set((state) => {
      const cached = state.archivedSessions[workspaceId] ?? [];
      return {
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        archivedSessions: { ...state.archivedSessions, [workspaceId]: [archived, ...cached] },
      };
    });

    try {
      await archiveSessionInDb(tauriDatabase, sessionId);
    } catch (err) {
      set((state) => {
        const cached = state.archivedSessions[workspaceId] ?? [];
        return {
          sessions: [...state.sessions, prev],
          archivedSessions: {
            ...state.archivedSessions,
            [workspaceId]: cached.filter((s) => s.id !== sessionId),
          },
        };
      });
      throw err;
    }

    void get()
      .loadDormantSpend(workspaceId)
      .catch(() => undefined);
    await get().recordSessionEvent({ sessionId, kind: 'session_archived' });

    await get()
      .cleanupSessionMounts({ sessionId, reason: 'archive' })
      .catch(() => undefined);

    if (isCurrent) {
      return;
    }

    dropPendingTurnEvents({
      agentIds: (get().sessionPhaseRuns[sessionId] ?? []).map((agent) => agent.id),
    });
    get().evictSession({ sessionId, mode: 'archive' });
  };
};
