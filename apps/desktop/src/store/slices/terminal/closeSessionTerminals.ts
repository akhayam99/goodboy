import type { SessionId } from '@goodboy/types';
import { invokeTerminalClose } from '../../../features/terminal/terminal';
import { clearTerminalCache } from '../../../shared/components/GenericTerminalPanel';
import type { SetFn, GetFn } from './types';

export const closeSessionTerminals = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId): void => {
    for (const tab of get().terminalTabs[sessionId] ?? []) {
      invokeTerminalClose(tab.id).catch(() => undefined);
      clearTerminalCache(tab.id);
    }
    if (get().terminalSessions[sessionId] === 'open') {
      invokeTerminalClose(sessionId).catch(() => undefined);
    }
    set((s) => {
      const nextTabs = { ...s.terminalTabs };
      delete nextTabs[sessionId];
      const nextActive = { ...s.activeTerminalTab };
      delete nextActive[sessionId];
      return { terminalTabs: nextTabs, activeTerminalTab: nextActive };
    });
  };
};
