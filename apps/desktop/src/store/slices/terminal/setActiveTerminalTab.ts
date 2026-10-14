import type { TerminalOwner, TerminalTabId } from '../../../shared/types/terminal';
import { terminalOwnerKey } from './terminalOwner';
import { terminalWorktreeKeyIn } from './terminalWorktree';
import { saveTerminalTabs } from './saveTerminalTabs';
import type { GetFn, SetFn } from './types';

type SelectParams = {
  readonly owner: TerminalOwner;
  readonly tabId: TerminalTabId;
};

export const setActiveTerminalTab = (set: SetFn, get: GetFn) => {
  return ({ owner, tabId }: SelectParams): void => {
    const key = terminalOwnerKey({ owner });
    const tab = (get().terminalTabs[key] ?? []).find((candidate) => candidate.id === tabId);
    const worktree = tab === undefined ? null : terminalWorktreeKeyIn({ state: get(), tab });
    set((s) => ({
      activeTerminalTab: { ...s.activeTerminalTab, [key]: tabId },
      ...(worktree === null
        ? {}
        : { terminalWorktreeActive: { ...s.terminalWorktreeActive, [worktree]: tabId } }),
    }));
    saveTerminalTabs({ get });
  };
};
