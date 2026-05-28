import type { ContextSlot } from '@goodboy/types';
import type { AppStore } from '../../store';

export type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
export type GetFn = () => AppStore;

export function mergeSlots(
  existing: ReadonlyArray<ContextSlot>,
  next: ContextSlot,
): ReadonlyArray<ContextSlot> {
  const idx = existing.findIndex((s) => s.key === next.key);
  if (idx === -1) return [...existing, next];
  const copy = existing.slice();
  copy[idx] = next;
  return copy;
}
