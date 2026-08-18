import { ensureSessionSlots } from './ensureSessionSlots';
import { loadSessionSlots } from './loadSessionSlots';
import { loadSessionTelemetry } from './loadSessionTelemetry';
import { loadSlotHistory } from './loadSlotHistory';
import { toggleSessionSlot } from './toggleSessionSlot';
import { upsertSessionSlot } from './upsertSessionSlot';
import type { GetFn, SetFn } from './types';

export const createSlotsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadSessionTelemetry: loadSessionTelemetry(set),
    loadSessionSlots: loadSessionSlots(set),
    ensureSessionSlots: ensureSessionSlots(get),
    upsertSessionSlot: upsertSessionSlot(set, get),
    loadSlotHistory: loadSlotHistory(set),
    toggleSessionSlot: toggleSessionSlot(set, get),
  };
};
