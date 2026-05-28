import { loadSessionSlots } from './loadSessionSlots';
import { loadSessionTelemetry } from './loadSessionTelemetry';
import { loadSlotHistory } from './loadSlotHistory';
import { toggleSessionSlot } from './toggleSessionSlot';
import { upsertSessionSlot } from './upsertSessionSlot';
import type { GetFn, SetFn } from './types';

export { mergeSlots } from './types';

export function createSlotsSlice(set: SetFn, get: GetFn) {
  return {
    loadSessionTelemetry: loadSessionTelemetry(set),
    loadSessionSlots: loadSessionSlots(set),
    upsertSessionSlot: upsertSessionSlot(set, get),
    loadSlotHistory: loadSlotHistory(set),
    toggleSessionSlot: toggleSessionSlot(set, get),
  };
}
