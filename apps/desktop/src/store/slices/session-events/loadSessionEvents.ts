import { listSessionEvents } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { sessionEventsLoadInFlight, type GetFn, type SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  force?: boolean;
}>;

export const loadSessionEvents = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, force = false }: Params): Promise<void> => {
    if (!force && get().sessionEvents?.[sessionId] !== undefined) {
      return;
    }
    if (sessionEventsLoadInFlight.has(sessionId)) {
      return;
    }
    sessionEventsLoadInFlight.add(sessionId);
    try {
      const events = await listSessionEvents({ db: tauriDatabase, sessionId });
      set((state) => ({
        sessionEvents: { ...state.sessionEvents, [sessionId]: events },
      }));
    } finally {
      sessionEventsLoadInFlight.delete(sessionId);
    }
  };
};
