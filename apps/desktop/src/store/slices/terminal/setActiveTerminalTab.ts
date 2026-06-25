import type { SessionId } from '@goodboy/types'
import type { TerminalTabId } from '../../../shared/types/terminal'
import type { SetFn } from './types'

export const setActiveTerminalTab = (set: SetFn) => {
  return (sessionId: SessionId, tabId: TerminalTabId): void => {
    set((s) => ({
      activeTerminalTab: { ...s.activeTerminalTab, [sessionId]: tabId },
    }))
  }
}
