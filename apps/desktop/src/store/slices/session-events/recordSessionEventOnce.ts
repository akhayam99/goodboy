import { listSessionEvents } from '@goodboy/db';
import type { SessionEventKind, SessionEventPayload, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { sessionEventsOnceInFlight, type GetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  kind: SessionEventKind;
  payload?: SessionEventPayload;
}>;

export const recordSessionEventOnce = (get: GetFn) => {
  return async ({ sessionId, kind, payload }: Params): Promise<void> => {
    const subject = payload?.number ?? null;
    const guardKey = `${sessionId}:${kind}:${subject ?? ''}`;
    if (sessionEventsOnceInFlight.has(guardKey)) {
      return;
    }
    sessionEventsOnceInFlight.add(guardKey);
    try {
      const recorded = await listSessionEvents({ db: tauriDatabase, sessionId });
      const isAlreadyRecorded = recorded.some(
        (event) => event.kind === kind && (event.payload?.number ?? null) === subject,
      );
      if (isAlreadyRecorded) {
        return;
      }
      await get().recordSessionEvent({
        sessionId,
        kind,
        ...(payload === undefined ? {} : { payload }),
      });
    } catch (error) {
      console.warn(`[session-events] dedupe check for ${kind} failed`, error);
    } finally {
      sessionEventsOnceInFlight.delete(guardKey);
    }
  };
};
