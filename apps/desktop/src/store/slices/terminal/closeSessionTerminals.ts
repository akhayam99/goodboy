import type { SessionId } from '@goodboy/types';
import { invokeTerminalClose } from '../../../features/terminal/terminal';
import { clearTerminalCache } from '../../../shared/components/GenericTerminalPanel/outputCache';
import type { SetFn, GetFn } from './types';

export const closeSessionTerminals = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const closing: Array<Promise<void>> = [];
    for (const tab of get().terminalTabs[sessionId] ?? []) {
      closing.push(invokeTerminalClose(tab.id).catch(() => undefined));
      clearTerminalCache(tab.id);
    }
    if (get().terminalSessions[sessionId] === 'open') {
      closing.push(invokeTerminalClose(sessionId).catch(() => undefined));
    }
    set((s) => {
      const nextTabs = { ...s.terminalTabs };
      delete nextTabs[sessionId];
      const nextActive = { ...s.activeTerminalTab };
      delete nextActive[sessionId];
      return { terminalTabs: nextTabs, activeTerminalTab: nextActive };
    });
    await Promise.all(closing);
  };
};
