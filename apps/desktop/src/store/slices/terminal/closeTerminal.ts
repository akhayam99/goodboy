import type { SessionId } from '@goodboy/types';
import { invokeTerminalClose } from '../../../features/terminal/terminal';
import type { SetFn } from './types';

export function closeTerminal(set: SetFn) {
  return async (sessionId: SessionId) => {
    await invokeTerminalClose(sessionId);
    set((s) => ({ terminalSessions: { ...s.terminalSessions, [sessionId]: 'closed' } }));
  };
}
