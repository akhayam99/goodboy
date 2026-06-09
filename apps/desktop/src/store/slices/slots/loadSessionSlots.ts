import type { ContextSlotHistoryEntry, SessionId } from '@goodboy/types';
import { listContextSlotHistory, listContextSlotsForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadSessionSlots = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const slots = await listContextSlotsForSession(tauriDatabase, sessionId);
    const histories = await Promise.all(
      slots.map((slot) => listContextSlotHistory(tauriDatabase, sessionId, slot.key)),
    );
    const slotHistory: Record<string, ReadonlyArray<ContextSlotHistoryEntry>> = {};
    slots.forEach((slot, i) => {
      const entries = histories[i];
      if (entries && entries.length > 0) slotHistory[slot.key] = entries;
    });
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [sessionId]: slots },
      slotHistory: {
        ...state.slotHistory,
        [sessionId]: { ...(state.slotHistory[sessionId] ?? {}), ...slotHistory },
      },
    }));
  };
};
