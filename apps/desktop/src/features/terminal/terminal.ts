import { invokeCommand } from '../../shared/lib/invokeCommand';

export type TerminalOutputPayload = {
  readonly sessionId: string;
  readonly data: string;
  readonly offset: number;
};

export type TerminalSnapshot = {
  readonly data: string;
  readonly offset: number;
  readonly exitCode: number | null;
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
  readonly foregroundCommand?: string | null;
};

export const invokeTerminalListLive = (): Promise<ReadonlyArray<LiveTerminal>> => {
  return invokeCommand<ReadonlyArray<LiveTerminal>>('terminal_list_live');
};

export const invokeTerminalSnapshot = (terminalId: string): Promise<TerminalSnapshot> => {
  return invokeCommand<TerminalSnapshot>('terminal_snapshot', { sessionId: terminalId });
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
