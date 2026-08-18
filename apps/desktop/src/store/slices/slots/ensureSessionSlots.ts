import type { SessionId } from '@goodboy/types';
import type { GetFn } from './types';

export const ensureSessionSlots = (get: GetFn) => {
  const readsInFlight = new Map<SessionId, Promise<void>>();
  return async (sessionId: SessionId) => {
    if (get().sessionSlotsLoad[sessionId] === 'loaded') {
      return;
    }
    const running = readsInFlight.get(sessionId);
    if (running !== undefined) {
      await running;
      return;
    }
    const read = get()
      .loadSessionSlots(sessionId)
      .finally(() => readsInFlight.delete(sessionId));
    readsInFlight.set(sessionId, read);
    await read;
  };
};
