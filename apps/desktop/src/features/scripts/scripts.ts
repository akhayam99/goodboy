import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceScriptId } from '@goodboy/types';

/** Result of running a workspace script. Mirrors the Rust `ScriptRunResult`. */
export interface ScriptRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** Run state for a script row in the Scripts panel. */
export type ScriptRunStatus = 'idle' | 'pending' | 'ok' | 'error' | 'cancelled';

/** A tracked script run for one (session, script) pair, held in the store. */
export interface ScriptRunRecord {
  readonly status: ScriptRunStatus;
  readonly result: ScriptRunResult | null;
  readonly runId: string;
}

export async function invokeScriptRun(
  scriptId: WorkspaceScriptId,
  runId: string,
  cwd: string,
): Promise<ScriptRunResult> {
  return invoke<ScriptRunResult>('workspace_script_run', { scriptId, runId, cwd });
}

/** Interrupt an in-flight script run. No-op if the run already finished. */
export async function invokeScriptCancel(runId: string): Promise<void> {
  return invoke<void>('workspace_script_cancel', { runId });
}
