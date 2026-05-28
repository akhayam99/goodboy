import type { ContextSlot, SessionId } from '@goodboy/types';
import type { SlotKey } from '@goodboy/core';
import { insertContextSlotHistory, listContextSlotHistory, upsertContextSlot } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { mergeSlots, type GetFn, type SetFn } from './types';

export function upsertSessionSlot(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, key: SlotKey, value: string) => {
    const existing = get().sessionSlots[sessionId] ?? [];
    const prev = existing.find((s) => s.key === key);
    if (prev && prev.value !== value) {
      await insertContextSlotHistory(
        tauriDatabase,
        sessionId,
        crypto.randomUUID(),
        key,
        prev.value,
        'user',
      );
    }
    const next: ContextSlot = { key, value, enabled: prev?.enabled ?? true };
    await upsertContextSlot(tauriDatabase, sessionId, next);
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
}
