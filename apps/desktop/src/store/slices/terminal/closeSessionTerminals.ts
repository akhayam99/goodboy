import type { SessionId } from '@goodboy/types';
import { invokeTerminalClose } from '../../../features/terminal/terminal';
import { terminalOutputBus } from '../../../features/terminal/outputBus';
import { saveTerminalTabs } from './saveTerminalTabs';
import type { SetFn, GetFn } from './types';

export const closeSessionTerminals = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const closing: Array<Promise<void>> = [];
    for (const tab of get().terminalTabs[sessionId] ?? []) {
      closing.push(invokeTerminalClose(tab.id).catch(() => undefined));
      terminalOutputBus.forget({ terminalId: tab.id });
    }
    if (get().terminalSessions[sessionId] === 'open') {
      closing.push(invokeTerminalClose(sessionId).catch(() => undefined));
    }
    const closedIds = new Set((get().terminalTabs[sessionId] ?? []).map((tab) => tab.id));
    set((s) => {
      const nextWorktreeActive = Object.fromEntries(
        Object.entries(s.terminalWorktreeActive).filter(([, active]) => !closedIds.has(active)),
      );
      const nextTabs = { ...s.terminalTabs };
      delete nextTabs[sessionId];
      const nextActive = { ...s.activeTerminalTab };
      delete nextActive[sessionId];
      return {
        terminalTabs: nextTabs,
        activeTerminalTab: nextActive,
        terminalWorktreeActive: nextWorktreeActive,
      };
    });
    saveTerminalTabs({ get });
    await Promise.all(closing);
  };
};
