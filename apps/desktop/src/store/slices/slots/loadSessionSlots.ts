import type { SessionId } from '@goodboy/types';
import { countContextSlotHistoryForSession, listContextSlotsForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadSessionSlots = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const [slots, counts] = await Promise.all([
      listContextSlotsForSession(tauriDatabase, sessionId),
      countContextSlotHistoryForSession(tauriDatabase, sessionId),
    ]);
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [sessionId]: slots },
      slotHistoryCounts: { ...state.slotHistoryCounts, [sessionId]: counts },
    }));
  };
};
