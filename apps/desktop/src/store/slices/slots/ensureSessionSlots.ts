import type { SessionId } from '@goodboy/types';
import type { GetFn } from './types';

export const ensureSessionSlots = (get: GetFn) => {
  return async (sessionId: SessionId) => {
    if (get().sessionSlotsLoad[sessionId] === 'loaded') {
      return;
    }
    await get().loadSessionSlots(sessionId);
  };
};
