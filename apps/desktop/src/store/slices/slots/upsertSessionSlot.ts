import type { ContextSlot, SessionId } from '@goodboy/types';
import type { SlotKey } from '@goodboy/core';
import { listContextSlotHistory, upsertContextSlot } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { mergeSlots, type GetFn, type SetFn } from './types';

export const upsertSessionSlot = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, key: SlotKey, value: string) => {
    const existing = get().sessionSlots[sessionId] ?? [];
    const prev = existing.find((s) => s.key === key);
    const next: ContextSlot = { key, value, enabled: prev?.enabled ?? true };
    await upsertContextSlot(tauriDatabase, sessionId, next, 'user');
    const refreshedHistory = await listContextSlotHistory(tauriDatabase, sessionId, key);
    set((state) => ({
      sessionSlots: {
        ...state.sessionSlots,
        [sessionId]: mergeSlots(state.sessionSlots[sessionId] ?? [], next),
      },
      slotHistory: {
        ...state.slotHistory,
        [sessionId]: {
          ...(state.slotHistory[sessionId] ?? {}),
          [key]: refreshedHistory,
        },
      },
    }));
  };
};
