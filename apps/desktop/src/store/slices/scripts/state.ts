import type { ProjectScript, SessionId, WorkspaceId } from '@goodboy/types';
import type { ScriptGroup, ScriptRunRecord } from '../../../features/scripts/scripts';

export type DiscoveredScriptScan = {
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
};

export type ScriptsSliceState = {
  readonly projectScripts: Readonly<Record<WorkspaceId, ReadonlyArray<ProjectScript>>>;
  readonly scriptRuns: Readonly<Record<SessionId, Readonly<Record<string, ScriptRunRecord>>>>;
  readonly discoveredScripts: Readonly<
    Record<SessionId, Readonly<Record<string, ReadonlyArray<ScriptGroup>>>>
  >;
  readonly discoveredScriptScans: Readonly<
    Record<SessionId, Readonly<Record<string, DiscoveredScriptScan>>>
  >;
};

export const initialScriptsState: ScriptsSliceState = {
  projectScripts: {},
  scriptRuns: {},
  discoveredScripts: {},
  discoveredScriptScans: {},
};
