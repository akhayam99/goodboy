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
  readonly name?: string;
};

export type ScriptSource = 'package-json' | 'composer';

export type DiscoveredScript = {
  readonly name: string;
  readonly command: string;
};

export type ScriptGroup = {
  readonly source: ScriptSource;
  readonly packageName: string;
  readonly relDir: string;
  readonly manager: string;
  readonly scripts: ReadonlyArray<DiscoveredScript>;
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
  readonly scriptId: string;
  readonly name: string;
  readonly sessionId: SessionId;
  readonly startedAt: number;
};

type ScanProjectScriptsParams = {
  readonly worktreePath: string;
};

type RunAdhocScriptParams = {
  readonly scriptId: string;
  readonly name: string;
  readonly body: string;
  readonly runId?: string;
  readonly sessionId: SessionId;
  readonly cwd: string;
  readonly cols?: number;
  readonly rows?: number;
};

type DiscoveredScriptIdParams = {
  readonly worktreePath: string;
  readonly source: ScriptSource;
  readonly relDir: string;
  readonly name: string;
};

type DiscoveredScriptCwdParams = {
  readonly worktreePath: string;
  readonly relDir: string;
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

export const scanProjectScripts = ({
  worktreePath,
}: ScanProjectScriptsParams): Promise<ReadonlyArray<ScriptGroup>> => {
  return invoke<ReadonlyArray<ScriptGroup>>('project_scripts_scan', { worktreePath });
};

export const runAdhocScript = ({
  scriptId,
  name,
  body,
  runId,
  sessionId,
  cwd,
  cols = 220,
  rows = 50,
}: RunAdhocScriptParams): Promise<string> => {
  return invoke<string>('workspace_script_run_adhoc', {
    scriptId,
    name,
    body,
    runId,
    sessionId,
    cwd,
    cols,
    rows,
  });
};

export const discoveredScriptId = ({
  worktreePath,
  source,
  relDir,
  name,
}: DiscoveredScriptIdParams): string => {
  return JSON.stringify([worktreePath, source, relDir, name]);
};

export const discoveredScriptCwd = ({
  worktreePath,
  relDir,
}: DiscoveredScriptCwdParams): string => {
  if (relDir === '') {
    return worktreePath;
  }
  return `${worktreePath.replace(/[\\/]+$/, '')}/${relDir}`;
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
