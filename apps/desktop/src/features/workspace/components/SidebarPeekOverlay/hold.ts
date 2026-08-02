import { createContext, useContext } from 'react';

export type SidebarPeekHold = {
  readonly hold: () => void;
  readonly release: () => void;
};

const NO_HOLD: SidebarPeekHold = {
  hold: () => undefined,
  release: () => undefined,
};

export const SidebarPeekHoldContext = createContext<SidebarPeekHold>(NO_HOLD);

export const useSidebarPeekHold = (): SidebarPeekHold => useContext(SidebarPeekHoldContext);
