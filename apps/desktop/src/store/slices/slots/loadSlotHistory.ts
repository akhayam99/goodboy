import type { SessionId } from '@goodboy/types';
import type { SlotKey } from '@goodboy/core';
import { listContextSlotHistory } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadSlotHistory = (set: SetFn) => {
  return async (sessionId: SessionId, key: SlotKey) => {
    const entries = await listContextSlotHistory(tauriDatabase, sessionId, key);
    set((state) => ({
      slotHistory: {
        ...state.slotHistory,
        [sessionId]: {
          ...(state.slotHistory[sessionId] ?? {}),
          [key]: entries,
        },
      },
      slotHistoryCounts: {
        ...state.slotHistoryCounts,
        [sessionId]: {
          ...(state.slotHistoryCounts[sessionId] ?? {}),
          [key]: entries.length,
        },
      },
    }));
  };
};
