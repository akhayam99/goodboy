import type { IsoDateTime, Session, SessionId } from '@goodboy/types';
import { archiveSession as archiveSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { dropPendingTurnEvents } from '../transcripts/buffer';
import { touchArchivedCache } from '../summaries/archivedCacheVersion';
import type { GetFn, SetFn } from './types';
import { sessionById } from './sessionIndex';
import { stopWork } from '../../runtime/live-work/stopWork';

const STILL_RUNNING_MESSAGE =
  'An agent did not stop, so the session stays where it was. Try Archive again.';

export const archiveTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const prev = sessionById(get().sessions, sessionId);
    if (!prev) {
      return;
    }
    const { stillRunning } = await stopWork({
      getState: get,
      scope: { kind: 'session', sessionId },
      reason: 'leave',
    });
    if (stillRunning > 0) {
      throw new Error(STILL_RUNNING_MESSAGE);
    }
    const nowIso = new Date().toISOString() as IsoDateTime;
    const archived: Session = { ...prev, archivedAt: nowIso };
    const workspaceId = prev.workspaceId;
    const isCurrent = get().currentSessionId === sessionId;

    touchArchivedCache({ workspaceId });
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
      touchArchivedCache({ workspaceId });
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
