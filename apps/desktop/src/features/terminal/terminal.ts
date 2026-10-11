import { invokeCommand } from '../../shared/lib/invokeCommand';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type TerminalOutputPayload = {
  readonly sessionId: string;
  readonly data: string;
};

export type TerminalExitPayload = {
  readonly sessionId: string;
  readonly exitCode: number;
};

export type LiveTerminal = {
  readonly id: string;
  readonly cwd: string;
  readonly pid: number | null;
  readonly foregroundPid: number | null;
};

export const invokeTerminalListLive = (): Promise<ReadonlyArray<LiveTerminal>> => {
  return invokeCommand<ReadonlyArray<LiveTerminal>>('terminal_list_live');
};

export const invokeTerminalOpen = (
  terminalId: string,
  cwd: string | null,
  cols: number,
  rows: number,
): Promise<void> => {
  return invokeCommand<void>('terminal_open', { sessionId: terminalId, cwd, cols, rows });
};

export const invokeTerminalWrite = (terminalId: string, data: string): Promise<void> => {
  return invokeCommand<void>('terminal_write', { sessionId: terminalId, data });
};

export const invokeTerminalResize = (
  terminalId: string,
  cols: number,
  rows: number,
): Promise<void> => {
  return invokeCommand<void>('terminal_resize', { sessionId: terminalId, cols, rows });
};

export const invokeTerminalClose = (terminalId: string): Promise<void> => {
  return invokeCommand<void>('terminal_close', { sessionId: terminalId });
};

export const listenTerminalOutput = (
  handler: (payload: TerminalOutputPayload) => void,
): Promise<UnlistenFn> => {
  return listen<TerminalOutputPayload>('terminal-output', (e) => handler(e.payload));
};

export const listenTerminalExit = (
  handler: (payload: TerminalExitPayload) => void,
): Promise<UnlistenFn> => {
  return listen<TerminalExitPayload>('terminal-exit', (e) => handler(e.payload));
};
