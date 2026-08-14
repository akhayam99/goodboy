import type { SessionId, WorkspaceScriptId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  invokeScriptRun,
  listenScriptExit,
  listenScriptOutput,
  type ScriptRunRecord,
  type ScriptRunResult,
} from '../../../features/scripts/scripts';
import type { GetFn, SetFn } from './types';

export const runScript = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    scriptId: WorkspaceScriptId,
    cwd: string,
    cols: number = 220,
    rows: number = 50,
  ) => {
    const runId = crypto.randomUUID();
    const startedAt = Date.now();

    const writeRun = (record: ScriptRunRecord) =>
      set((state) => ({
        scriptRuns: {
          ...state.scriptRuns,
          [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: record },
        },
      }));

    writeRun({ status: 'pending', result: null, runId, startedAt });

    let unlistenExit: () => void = () => undefined;
    let unlistenOutput: () => void = () => undefined;
    let resolveResult!: (r: ScriptRunResult) => void;
    let rejectResult!: (e: unknown) => void;
    const resultPromise = new Promise<ScriptRunResult>((res, rej) => {
      resolveResult = res;
      rejectResult = rej;
    });

    const STDOUT_CAP = 64 * 1024;
    const ANSI_RE = /\x1B\[[0-?]*[ -/]*[@-~]/g;
    let stdoutBuf = '';
    let truncated = false;

    unlistenOutput = await listenScriptOutput((payload) => {
      if (payload.runId !== runId) {
        return;
      }
      if (truncated) {
        return;
      }
      const chunk = atob(payload.data);
      if (stdoutBuf.length + chunk.length > STDOUT_CAP) {
        stdoutBuf = '…(truncated)\n' + (stdoutBuf + chunk).slice(-(STDOUT_CAP - 14));
        truncated = true;
      } else {
        stdoutBuf += chunk;
      }
    });

    unlistenExit = await listenScriptExit((payload) => {
      if (payload.runId !== runId) {
        return;
      }
      unlistenExit();
      unlistenOutput();
      const curr = get().scriptRuns[sessionId]?.[scriptId];
      if (!curr || curr.runId !== runId) {
        return;
      }
      const stdout = stdoutBuf.replace(ANSI_RE, '');
      const result: ScriptRunResult = { stdout, stderr: '', exitCode: payload.exitCode };
      writeRun({
        status: curr.status === 'cancelled' ? 'cancelled' : payload.exitCode === 0 ? 'ok' : 'error',
        result,
        runId,
        startedAt,
      });
      resolveResult(result);
    });

    try {
      await invokeScriptRun(scriptId, runId, cwd, cols, rows);
    } catch (err) {
      unlistenExit();
      unlistenOutput();
      const result: ScriptRunResult = { stdout: '', stderr: formatError(err), exitCode: -1 };
      writeRun({ status: 'error', result, runId, startedAt });
      rejectResult(err);
      return result;
    }

    return resultPromise;
  };
};
