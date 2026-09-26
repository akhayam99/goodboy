import type { ContextSlot, ContextSlotHistoryEntry, SessionId } from '@goodboy/types';
import { loadDecisionLedger, reconcileDecisionsText, type SlotKey } from '@goodboy/core';
import {
  countContextSlotHistoryForSession,
  listContextSlotHistory,
  upsertContextSlot,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { mergeSlots, type GetFn, type SetFn } from './types';

export const upsertSessionSlot = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, key: SlotKey, value: string) => {
    const wasHistoryLoaded = get().slotHistory[sessionId]?.[key] !== undefined;
    if (key === 'decisions') {
      const ledger = await loadDecisionLedger({ db: tauriDatabase, sessionId });
      await get().applySessionDecisionOps({
        sessionId,
        ops: reconcileDecisionsText({ ledger, text: value }),
        actor: { author: 'user', agentId: null, turnOrdinal: null },
      });
    }
    const existing = get().sessionSlots[sessionId] ?? [];
    const prev = existing.find((s) => s.key === key);
    const next: ContextSlot = { key, value, enabled: prev?.enabled ?? true };
    if (key !== 'decisions') {
      await upsertContextSlot(tauriDatabase, sessionId, next, 'user');
    }
    const [counts, refreshedHistory] = await Promise.all([
      countContextSlotHistoryForSession(tauriDatabase, sessionId),
      wasHistoryLoaded
        ? listContextSlotHistory(tauriDatabase, sessionId, key)
        : Promise.resolve<ReadonlyArray<ContextSlotHistoryEntry> | null>(null),
    ]);
    set((state) => ({
      sessionSlots:
        key === 'decisions'
          ? state.sessionSlots
          : {
              ...state.sessionSlots,
              [sessionId]: mergeSlots(state.sessionSlots[sessionId] ?? [], next),
            },
      slotHistory:
        refreshedHistory === null
          ? state.slotHistory
          : {
              ...state.slotHistory,
              [sessionId]: {
                ...(state.slotHistory[sessionId] ?? {}),
                [key]: refreshedHistory,
              },
            },
      slotHistoryCounts: { ...state.slotHistoryCounts, [sessionId]: counts },
    }));
  };
};
