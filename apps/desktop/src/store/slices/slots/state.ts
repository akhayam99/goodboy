import type { ContextSlot, ContextSlotHistoryEntry } from '@goodboy/types';

export type SessionSlotsLoad = 'loaded' | 'failed';

export type SlotsState = {
  readonly sessionSlots: Readonly<Record<string, ReadonlyArray<ContextSlot>>>;
  readonly slotHistory: Readonly<
    Record<string, Readonly<Record<string, ReadonlyArray<ContextSlotHistoryEntry>>>>
  >;
  readonly slotHistoryCounts: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly sessionSlotsLoad: Readonly<Record<string, SessionSlotsLoad>>;
};

export const slotsInitialState: SlotsState = {
  sessionSlots: {},
  slotHistory: {},
  slotHistoryCounts: {},
  sessionSlotsLoad: {},
};
