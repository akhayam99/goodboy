import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ProjectScriptId, SessionId } from '@goodboy/types';

export type ScriptRunResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type ScriptRunStatus = 'idle' | 'pending' | 'ok' | 'error' | 'cancelled';

export type ScriptRunRecord = {
  readonly status: ScriptRunStatus;
  readonly result: ScriptRunResult | null;
  readonly runId: string;
  readonly startedAt: number;
};

export type ScriptOutputPayload = {
  readonly runId: string;
  readonly data: string;
};

export type ScriptExitPayload = {
  readonly runId: string;
  readonly exitCode: number;
};

export type LiveScriptRun = {
  readonly runId: string;
  readonly scriptId: ProjectScriptId;
  readonly sessionId: SessionId;
  readonly startedAt: number;
};

type InvokeScriptRunParams = {
  readonly scriptId: ProjectScriptId;
  readonly runId: string;
  readonly sessionId: SessionId;
  readonly cwd: string;
  readonly cols: number;
  readonly rows: number;
};

export const invokeScriptRun = ({
  scriptId,
  runId,
  sessionId,
  cwd,
  cols,
  rows,
}: InvokeScriptRunParams): Promise<void> => {
  return invoke<void>('workspace_script_run', { scriptId, runId, sessionId, cwd, cols, rows });
};

export const invokeScriptListLive = (): Promise<ReadonlyArray<LiveScriptRun>> => {
  return invoke<ReadonlyArray<LiveScriptRun>>('workspace_script_list_live');
};

export const invokeScriptCancel = (runId: string): Promise<void> => {
  return invoke<void>('workspace_script_cancel', { runId });
};

export const listenScriptOutput = (
  handler: (payload: ScriptOutputPayload) => void,
): Promise<UnlistenFn> => {
  return listen<ScriptOutputPayload>('script-output', (e) => handler(e.payload));
};

export const listenScriptExit = (
  handler: (payload: ScriptExitPayload) => void,
): Promise<UnlistenFn> => {
  return listen<ScriptExitPayload>('script-exit', (e) => handler(e.payload));
};
