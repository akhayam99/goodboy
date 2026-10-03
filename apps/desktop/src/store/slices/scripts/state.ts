import type { ProjectScript, SessionId, WorkspaceId } from '@goodboy/types';
import type { ScriptGroup, ScriptRunRecord } from '../../../features/scripts/scripts';

export type DiscoveredScriptScan = {
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
};

export type ProjectRootScripts = {
  readonly status: 'loading' | 'ready' | 'error';
  readonly groups: ReadonlyArray<ScriptGroup>;
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
  readonly projectRootScripts: Readonly<Record<string, ProjectRootScripts>>;
};

export const initialScriptsState: ScriptsSliceState = {
  projectScripts: {},
  scriptRuns: {},
  discoveredScripts: {},
  discoveredScriptScans: {},
  projectRootScripts: {},
};
