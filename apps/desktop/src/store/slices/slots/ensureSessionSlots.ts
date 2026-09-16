import type { ContextSlot, SessionId } from '@goodboy/types';
import type { GetFn } from './types';

export const ensureSessionSlots = (get: GetFn) => {
  const readsInFlight = new Map<SessionId, Promise<void>>();
  return async (sessionId: SessionId): Promise<ReadonlyArray<ContextSlot>> => {
    if (get().sessionSlotsLoad[sessionId] === 'loaded') {
      return get().sessionSlots[sessionId] ?? [];
    }
    const running = readsInFlight.get(sessionId);
    if (running !== undefined) {
      await running;
      return get().sessionSlots[sessionId] ?? [];
    }
    const read = get()
      .loadSessionSlots(sessionId)
      .finally(() => readsInFlight.delete(sessionId));
    readsInFlight.set(sessionId, read);
    await read;
    return get().sessionSlots[sessionId] ?? [];
  };
};
