import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceScriptId } from '@kay-am/types';

/** Result of running a workspace script. Mirrors the Rust `ScriptRunResult`. */
export interface ScriptRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** Run state for a script row in the Scripts panel. */
export type ScriptRunStatus = 'idle' | 'pending' | 'ok' | 'error';

export async function invokeScriptRun(scriptId: WorkspaceScriptId): Promise<ScriptRunResult> {
  return invoke<ScriptRunResult>('workspace_script_run', { scriptId });
}
