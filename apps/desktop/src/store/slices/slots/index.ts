import { ensureSessionSlots } from './ensureSessionSlots';
import { loadSessionSlots } from './loadSessionSlots';
import { loadSessionTelemetry } from './loadSessionTelemetry';
import { loadSlotHistory } from './loadSlotHistory';
import { upsertSessionSlot } from './upsertSessionSlot';
import type { SliceDeps } from '../../slice-types';

export const createSlotsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadSessionTelemetry: loadSessionTelemetry(set),
    loadSessionSlots: loadSessionSlots(set),
    ensureSessionSlots: ensureSessionSlots(get),
    upsertSessionSlot: upsertSessionSlot(set, get),
    loadSlotHistory: loadSlotHistory(set),
  };
};
