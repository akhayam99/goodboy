import { create } from 'zustand';
import type { ChipState } from './callChipTypes';

type CallChipState = {
  readonly state: ChipState;
};

export const useCallChipStore = create<CallChipState>(() => ({
  state: { kind: 'hidden' },
}));
