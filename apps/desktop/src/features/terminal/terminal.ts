import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type TerminalOutputPayload = {
  readonly sessionId: string;
  readonly data: string;
};

export type TerminalExitPayload = {
  readonly sessionId: string;
  readonly exitCode: number;
};

export function invokeTerminalOpen(
  terminalId: string,
  cwd: string | null,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke<void>('terminal_open', { sessionId: terminalId, cwd, cols, rows });
}

export function invokeTerminalWrite(terminalId: string, data: string): Promise<void> {
  return invoke<void>('terminal_write', { sessionId: terminalId, data });
}

export function invokeTerminalResize(
  terminalId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke<void>('terminal_resize', { sessionId: terminalId, cols, rows });
}

export function invokeTerminalClose(terminalId: string): Promise<void> {
  return invoke<void>('terminal_close', { sessionId: terminalId });
}

export function listenTerminalOutput(
  handler: (payload: TerminalOutputPayload) => void,
): Promise<UnlistenFn> {
  return listen<TerminalOutputPayload>('terminal-output', (e) => handler(e.payload));
}

export function listenTerminalExit(
  handler: (payload: TerminalExitPayload) => void,
): Promise<UnlistenFn> {
  return listen<TerminalExitPayload>('terminal-exit', (e) => handler(e.payload));
}
