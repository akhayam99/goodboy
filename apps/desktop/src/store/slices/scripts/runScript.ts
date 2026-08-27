import type { ProjectScriptId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  invokeScriptRun,
  listenScriptExit,
  listenScriptOutput,
  type ScriptRunRecord,
  type ScriptRunResult,
} from '../../../features/scripts/scripts';
import { resolveProjectMountPath } from '../worktrees/resolveProjectMountPath';
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

    let unlistenExit: () => void = () => undefined;
    let unlistenOutput: () => void = () => undefined;
    let resolveResult: ((result: ScriptRunResult) => void) | null = null;
    const resultPromise = new Promise<ScriptRunResult>((resolve) => {
      resolveResult = resolve;
    });

    const stdoutCap = 64 * 1024;
    const ansiPattern = /\x1B\[[0-?]*[ -/]*[@-~]/g;
    let stdoutBuffer = '';
    let isTruncated = false;

    unlistenOutput = await listenScriptOutput((payload) => {
      if (payload.runId !== runId || isTruncated) {
        return;
      }
      const chunk = atob(payload.data);
      if (stdoutBuffer.length + chunk.length > stdoutCap) {
        stdoutBuffer = '…(truncated)\n' + (stdoutBuffer + chunk).slice(-(stdoutCap - 14));
        isTruncated = true;
        return;
      }
      stdoutBuffer += chunk;
    });

    unlistenExit = await listenScriptExit((payload) => {
      if (payload.runId !== runId) {
        return;
      }
      unlistenExit();
      unlistenOutput();
      const current = get().scriptRuns[sessionId]?.[scriptId];
      if (current == null || current.runId !== runId) {
        return;
      }
      const stdout = stdoutBuffer.replace(ansiPattern, '');
      const result: ScriptRunResult = { stdout, stderr: '', exitCode: payload.exitCode };
      writeRun({
        record: {
          status:
            current.status === 'cancelled' ? 'cancelled' : payload.exitCode === 0 ? 'ok' : 'error',
          result,
          runId,
          startedAt,
        },
      });
      resolveResult?.(result);
    });

    try {
      await invokeScriptRun(scriptId, runId, cwd, cols, rows);
    } catch (caughtError) {
      unlistenExit();
      unlistenOutput();
      const result: ScriptRunResult = {
        stdout: '',
        stderr: formatError(caughtError),
        exitCode: -1,
      };
      writeRun({ record: { status: 'error', result, runId, startedAt } });
      return result;
    }

    return resultPromise;
  };
};
