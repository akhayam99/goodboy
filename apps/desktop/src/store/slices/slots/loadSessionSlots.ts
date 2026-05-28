import type { SessionId } from '@goodboy/types';
import { listContextSlotsForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export function loadSessionSlots(set: SetFn) {
  return async (sessionId: SessionId) => {
    const slots = await listContextSlotsForSession(tauriDatabase, sessionId);
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [sessionId]: slots },
    }));
  };
}
