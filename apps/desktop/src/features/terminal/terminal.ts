import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { SessionId } from '@goodboy/types';

export interface TerminalOutputPayload {
  readonly sessionId: string;
  readonly data: string;
}

export interface TerminalExitPayload {
  readonly sessionId: string;
  readonly exitCode: number;
}

/** Open (or reuse) an interactive bash session for the given sessionId. */
export function invokeTerminalOpen(
  sessionId: SessionId,
  cwd: string | null,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke<void>('terminal_open', { sessionId, cwd, cols, rows });
}

/** Send keyboard input (base64-encoded) to the terminal. */
export function invokeTerminalWrite(sessionId: SessionId, data: string): Promise<void> {
  return invoke<void>('terminal_write', { sessionId, data });
}

/** Notify the pty of a resize. */
export function invokeTerminalResize(
  sessionId: SessionId,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke<void>('terminal_resize', { sessionId, cols, rows });
}

/** Kill the terminal session. No-op if already closed. */
export function invokeTerminalClose(sessionId: SessionId): Promise<void> {
  return invoke<void>('terminal_close', { sessionId });
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
