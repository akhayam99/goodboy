import { stripControlMarkers } from '@goodboy/core/context';
import type { ContextSlot } from '@goodboy/types';
import { safeTextOf } from './safeTextOf';

export const SUMMARY_MAX = 600;

const SUMMARY_SLOT = 'last_output_summary';

type Params = {
  readonly slots: ReadonlyArray<ContextSlot> | undefined;
};

export const summaryOf = ({ slots }: Params): string | null => {
  const slot = (slots ?? []).find((candidate) => candidate.key === SUMMARY_SLOT);
  if (slot === undefined || !slot.enabled) {
    return null;
  }
  const clean = safeTextOf({ text: stripControlMarkers(slot.value.trim()), max: SUMMARY_MAX });
  return clean.length === 0 ? null : clean;
};
