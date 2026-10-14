import { invokeTerminalClose } from '../../../features/terminal/terminal';
import { terminalOutputBus } from '../../../features/terminal/outputBus';
import type { TerminalOwner, TerminalTabId } from '../../../shared/types/terminal';
import { persistTerminalNames } from './persistTerminalNames';
import { terminalOwnerKey } from './terminalOwner';
import { terminalWorktreeKeyIn, worktreeSiblings } from './terminalWorktree';
import { saveTerminalTabs } from './saveTerminalTabs';
import type { GetFn, SetFn } from './types';

type CloseParams = {
  readonly owner: TerminalOwner;
  readonly tabId: TerminalTabId;
};

export const closeTerminalTab = (set: SetFn, get: GetFn) => {
  return ({ owner, tabId }: CloseParams): void => {
    invokeTerminalClose(tabId).catch(() => undefined);
    terminalOutputBus.forget({ terminalId: tabId });
    const key = terminalOwnerKey({ owner });
    const tabs = get().terminalTabs[key] ?? [];
    const index = tabs.findIndex((t) => t.id === tabId);
    const remaining = tabs.filter((t) => t.id !== tabId);
    const hasName = get().terminalNames[tabId] !== undefined;
    const closing = tabs[index];
    const closingWorktree =
      closing === undefined ? null : terminalWorktreeKeyIn({ state: get(), tab: closing });
    const siblings = closing === undefined ? [] : worktreeSiblings({ state: get(), tab: closing });
    const siblingIndex = siblings.findIndex((candidate) => candidate.id === tabId);
    const siblingsLeft = siblings.filter((candidate) => candidate.id !== tabId);
    const siblingNext = siblingsLeft[siblingIndex - 1] ?? siblingsLeft[0] ?? null;
    set((s) => {
      const wasActive = s.activeTerminalTab[key] === tabId;
      let nextActive = s.activeTerminalTab[key] ?? null;
      if (wasActive) {
        const fallback = remaining[index - 1] ?? remaining[remaining.length - 1] ?? null;
        nextActive = fallback ? fallback.id : null;
      }
      const names = Object.fromEntries(
        Object.entries(s.terminalNames).filter(([id]) => id !== tabId),
      );
      const worktreeActive = Object.fromEntries(
        Object.entries(s.terminalWorktreeActive).filter(
          ([worktree, active]) => worktree !== closingWorktree || active !== tabId,
        ),
      );
      const shouldFallback =
        closingWorktree !== null &&
        siblingNext !== null &&
        s.terminalWorktreeActive[closingWorktree] === tabId;
      return {
        terminalTabs: { ...s.terminalTabs, [key]: remaining },
        activeTerminalTab: { ...s.activeTerminalTab, [key]: nextActive },
        terminalWorktreeActive: shouldFallback
          ? { ...worktreeActive, [closingWorktree]: siblingNext.id }
          : worktreeActive,
        terminalNames: names,
      };
    });
    saveTerminalTabs({ get });
    if (hasName) {
      persistTerminalNames({ names: get().terminalNames }).catch((error) =>
        get().reportError({
          title: 'Could not forget the terminal name',
          error,
          ...(owner.kind === 'session'
            ? { sessionId: owner.sessionId }
            : { workspaceId: owner.workspaceId }),
        }),
      );
    }
  };
};
