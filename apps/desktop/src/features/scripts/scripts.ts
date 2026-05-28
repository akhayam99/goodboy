import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { WorkspaceScriptId } from '@goodboy/types';

export interface ScriptRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export type ScriptRunStatus = 'idle' | 'pending' | 'ok' | 'error' | 'cancelled';

export interface ScriptRunRecord {
  readonly status: ScriptRunStatus;
  readonly result: ScriptRunResult | null;
  readonly runId: string;
}

export interface ScriptOutputPayload {
  readonly runId: string;
  readonly data: string;
}

export interface ScriptExitPayload {
  readonly runId: string;
  readonly exitCode: number;
}

/** Start a pty-backed script run. Returns immediately; output streams via events. */
export function invokeScriptRun(
  scriptId: WorkspaceScriptId,
  runId: string,
  cwd: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke<void>('workspace_script_run', { scriptId, runId, cwd, cols, rows });
}

/** Interrupt an in-flight script run. No-op if the run already finished. */
export function invokeScriptCancel(runId: string): Promise<void> {
  return invoke<void>('workspace_script_cancel', { runId });
}

export function listenScriptOutput(
  handler: (payload: ScriptOutputPayload) => void,
): Promise<UnlistenFn> {
  return listen<ScriptOutputPayload>('script-output', (e) => handler(e.payload));
}

export function listenScriptExit(
  handler: (payload: ScriptExitPayload) => void,
): Promise<UnlistenFn> {
  return listen<ScriptExitPayload>('script-exit', (e) => handler(e.payload));
}
