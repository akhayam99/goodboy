import type { SessionId } from '@goodboy/types'
import type { TerminalTabId, TerminalTabStatus } from '../../../shared/types/terminal'
import type { SetFn } from './types'

export const setTerminalTabStatus = (set: SetFn) => {
  return (sessionId: SessionId, tabId: TerminalTabId, status: TerminalTabStatus): void => {
    set((s) => {
      const tabs = s.terminalTabs[sessionId] ?? []
      return {
        terminalTabs: {
          ...s.terminalTabs,
          [sessionId]: tabs.map((t) => (t.id === tabId ? { ...t, status } : t)),
        },
      }
    })
  }
}
