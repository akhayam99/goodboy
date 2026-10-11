import { invokeTerminalClose } from '../../../features/terminal/terminal';
import { terminalOutputBus } from '../../../features/terminal/outputBus';
import type { TerminalOwner, TerminalTabId } from '../../../shared/types/terminal';
import { persistTerminalNames } from './persistTerminalNames';
import { terminalOwnerKey } from './terminalOwner';
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
      return {
        terminalTabs: { ...s.terminalTabs, [key]: remaining },
        activeTerminalTab: { ...s.activeTerminalTab, [key]: nextActive },
        terminalNames: names,
      };
    });
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
