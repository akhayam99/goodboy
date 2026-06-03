import type { SessionId } from '@goodboy/types';
import { invokeTerminalClose } from '../../../features/terminal/terminal';
import { clearTerminalCache } from '../../../shared/components/GenericTerminalPanel';
import type { TerminalTabId } from '../../../shared/types/terminal';
import type { GetFn, SetFn } from './types';

export function closeTerminalTab(set: SetFn, get: GetFn) {
  return (sessionId: SessionId, tabId: TerminalTabId): void => {
    invokeTerminalClose(tabId).catch(() => undefined);
    clearTerminalCache(tabId);
    const tabs = get().terminalTabs[sessionId] ?? [];
    const index = tabs.findIndex((t) => t.id === tabId);
    const remaining = tabs.filter((t) => t.id !== tabId);
    set((s) => {
      const wasActive = s.activeTerminalTab[sessionId] === tabId;
      let nextActive = s.activeTerminalTab[sessionId] ?? null;
      if (wasActive) {
        const fallback = remaining[index - 1] ?? remaining[remaining.length - 1] ?? null;
        nextActive = fallback ? fallback.id : null;
      }
      return {
        terminalTabs: { ...s.terminalTabs, [sessionId]: remaining },
        activeTerminalTab: { ...s.activeTerminalTab, [sessionId]: nextActive },
      };
    });
  };
}
