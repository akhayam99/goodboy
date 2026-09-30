import type { ContextSlot, ContextSlotHistoryEntry, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { SessionSlotsLoad } from './state';

const EMPTY_SLOTS: ReadonlyArray<ContextSlot> = [];

export const useSessionSlots = (sessionId: SessionId | null): ReadonlyArray<ContextSlot> =>
  useAppStore((s) => (sessionId ? (s.sessionSlots[sessionId] ?? EMPTY_SLOTS) : EMPTY_SLOTS));

export const useSessionSlotsLoad = (sessionId: SessionId | null): SessionSlotsLoad | null =>
  useAppStore((s) => (sessionId ? (s.sessionSlotsLoad[sessionId] ?? null) : null));

const EMPTY_HISTORY: ReadonlyArray<ContextSlotHistoryEntry> = [];

export const useSlotHistory = (
  sessionId: SessionId | null,
  key: string,
): ReadonlyArray<ContextSlotHistoryEntry> =>
  useAppStore((s) =>
    sessionId ? (s.slotHistory[sessionId]?.[key] ?? EMPTY_HISTORY) : EMPTY_HISTORY,
  );

export const useSlotHistoryCount = (sessionId: SessionId | null, key: string): number =>
  useAppStore((s) => (sessionId ? (s.slotHistoryCounts[sessionId]?.[key] ?? 0) : 0));
