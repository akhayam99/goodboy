import type { TerminalOwner, TerminalTabId } from '../../../shared/types/terminal';
import { terminalOwnerKey } from './terminalOwner';
import type { SetFn } from './types';

type SelectParams = {
  readonly owner: TerminalOwner;
  readonly tabId: TerminalTabId;
};

export const setActiveTerminalTab = (set: SetFn) => {
  return ({ owner, tabId }: SelectParams): void => {
    set((s) => ({
      activeTerminalTab: { ...s.activeTerminalTab, [terminalOwnerKey({ owner })]: tabId },
    }));
  };
};
