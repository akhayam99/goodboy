import type { ContextSlot } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export const mergeSlots = (
  existing: ReadonlyArray<ContextSlot>,
  next: ContextSlot,
): ReadonlyArray<ContextSlot> => {
  const idx = existing.findIndex((s) => s.key === next.key);
  if (idx === -1) return [...existing, next];
  const copy = existing.slice();
  copy[idx] = next;
  return copy;
};
