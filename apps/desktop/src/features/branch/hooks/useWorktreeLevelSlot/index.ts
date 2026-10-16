import { useSyncExternalStore } from 'react';
import { worktreeLevelSlot } from '../../worktreeLevelSlot';

export const useWorktreeLevelSlot = (): HTMLElement | null =>
  useSyncExternalStore(worktreeLevelSlot.subscribe, worktreeLevelSlot.get, () => null);
