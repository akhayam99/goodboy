import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { WorkspaceScript, WorkspaceScriptId } from '@goodboy/types';

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
};

export type ScriptResultState = {
  readonly script: WorkspaceScript;
  readonly status: 'pending' | 'ok' | 'error';
  readonly result: ScriptRunResult | null;
};

export type ScriptOutputPayload = {
  readonly runId: string;
  readonly data: string;
};

export type ScriptExitPayload = {
  readonly runId: string;
  readonly exitCode: number;
};

export const invokeScriptRun = (
  scriptId: WorkspaceScriptId,
  runId: string,
  cwd: string,
  cols: number,
  rows: number,
): Promise<void> => {
  return invoke<void>('workspace_script_run', { scriptId, runId, cwd, cols, rows });
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
