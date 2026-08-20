import { insertSessionEvent } from '@goodboy/db';
import type {
  IsoDateTime,
  SessionEvent,
  SessionEventId,
  SessionEventKind,
  SessionEventPayload,
  SessionId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { mergeSessionEvents, type SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  kind: SessionEventKind;
  payload?: SessionEventPayload;
}>;

export const recordSessionEvent = (set: SetFn) => {
  return async ({ sessionId, kind, payload }: Params): Promise<void> => {
    const event: SessionEvent = {
      id: crypto.randomUUID() as SessionEventId,
      sessionId,
      kind,
      payload: payload ?? null,
      createdAt: new Date().toISOString() as IsoDateTime,
    };
    try {
      await insertSessionEvent({ db: tauriDatabase, event });
    } catch (error) {
      console.warn(`[session-events] persist ${kind} failed`, error);
      return;
    }
    set((state) => {
      const existing = state.sessionEvents?.[sessionId];
      if (existing === undefined) {
        return {};
      }
      return {
        sessionEvents: {
          ...state.sessionEvents,
          [sessionId]: mergeSessionEvents({ existing, next: event }),
        },
      };
    });
  };
};
