import type { SessionId } from '@goodboy/types';
import { invokeTerminalOpen } from '../../../features/terminal/terminal';
import type { SetFn } from './types';

export function openTerminal(set: SetFn) {
  return async (sessionId: SessionId, cwd: string | null, cols: number, rows: number) => {
    await invokeTerminalOpen(sessionId, cwd, cols, rows);
    set((s) => ({ terminalSessions: { ...s.terminalSessions, [sessionId]: 'open' } }));
  };
}
