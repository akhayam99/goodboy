import type { ProjectScriptId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  invokeScriptRun,
  type ScriptRunRecord,
  type ScriptRunResult,
} from '../../../features/scripts/scripts';
import { resolveProjectMountPath } from '../worktrees/resolveProjectMountPath';
import { registerScriptRunListeners } from './registerScriptRunListeners';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly scriptId: ProjectScriptId;
  readonly cols?: number;
  readonly rows?: number;
};

type WriteRunParams = {
  readonly record: ScriptRunRecord;
};

export const runScript = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, scriptId, cols = 220, rows = 50 }: Params) => {
    const runId = crypto.randomUUID();
    const startedAt = Date.now();

    const writeRun = ({ record }: WriteRunParams) =>
      set((state) => ({
        scriptRuns: {
          ...state.scriptRuns,
          [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: record },
        },
      }));

    writeRun({ record: { status: 'pending', result: null, runId, startedAt } });

    const state = get();
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    const script =
      session === undefined
        ? undefined
        : (state.projectScripts[session.workspaceId] ?? []).find(
            (candidate) => candidate.id === scriptId,
          );
    const cwd =
      script === undefined
        ? null
        : resolveProjectMountPath({ state, sessionId, projectId: script.projectId });
    if (script === undefined || cwd === null) {
      const project =
        script === undefined
          ? undefined
          : state.projects.find((candidate) => candidate.id === script.projectId);
      const message =
        script === undefined
          ? 'Script is not available in this session'
          : `${project?.name ?? 'Script project'} is not mounted in this session`;
      const result: ScriptRunResult = { stdout: '', stderr: message, exitCode: -1 };
      writeRun({ record: { status: 'error', result, runId, startedAt } });
      return result;
    }

    const registered = await registerScriptRunListeners({
      set,
      get,
      sessionId,
      scriptId,
      runId,
      startedAt,
    });

    try {
      await invokeScriptRun({ scriptId, runId, sessionId, cwd, cols, rows });
    } catch (caughtError) {
      registered.dispose();
      const result: ScriptRunResult = {
        stdout: '',
        stderr: formatError(caughtError),
        exitCode: -1,
      };
      writeRun({ record: { status: 'error', result, runId, startedAt } });
      return result;
    }

    return registered.result;
  };
};
