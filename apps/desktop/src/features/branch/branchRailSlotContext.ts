import { createContext } from 'react';

export type BranchRailSlot = Readonly<{
  host: HTMLElement | null;
  pane: HTMLElement | null;
}>;

export const BranchRailSlotContext = createContext<BranchRailSlot | null>(null);
