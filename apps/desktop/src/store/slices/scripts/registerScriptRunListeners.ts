import type { ProjectScriptId, SessionId } from '@goodboy/types';
import {
  listenScriptExit,
  listenScriptOutput,
  type ScriptRunRecord,
  type ScriptRunResult,
} from '../../../features/scripts/scripts';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly scriptId: ProjectScriptId;
  readonly runId: string;
  readonly startedAt: number;
};

type WriteRunParams = {
  readonly record: ScriptRunRecord;
};

export type RegisteredScriptRun = {
  readonly result: Promise<ScriptRunResult>;
  readonly dispose: () => void;
};

export const registerScriptRunListeners = async ({
  set,
  get,
  sessionId,
  scriptId,
  runId,
  startedAt,
}: Params): Promise<RegisteredScriptRun> => {
  const writeRun = ({ record }: WriteRunParams): void => {
    set((state) => ({
      scriptRuns: {
        ...state.scriptRuns,
        [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: record },
      },
    }));
  };
  let unlistenExit = (): void => undefined;
  let unlistenOutput = (): void => undefined;
  let resolveResult: ((result: ScriptRunResult) => void) | null = null;
  const result = new Promise<ScriptRunResult>((resolve) => {
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
    const completed: ScriptRunResult = { stdout, stderr: '', exitCode: payload.exitCode };
    writeRun({
      record: {
        status:
          current.status === 'cancelled' ? 'cancelled' : payload.exitCode === 0 ? 'ok' : 'error',
        result: completed,
        runId,
        startedAt,
      },
    });
    resolveResult?.(completed);
  });

  return {
    result,
    dispose: () => {
      unlistenExit();
      unlistenOutput();
    },
  };
};
