import type { SessionId } from '@goodboy/types';
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
  readonly scriptId: string;
  readonly runId: string;
  readonly startedAt: number;
  readonly name?: string;
};

type WriteRunParams = {
  readonly record: ScriptRunRecord;
};

const STDOUT_CAP = 64 * 1024;
const OUTPUT_FLUSH_MS = 100;
const TRUNCATED_PREFIX = '…(truncated)\n';
const ANSI_PATTERN = /\x1B\[[0-?]*[ -/]*[@-~]/g;

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
  name,
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
  let stdoutBuffer = '';
  let isTruncated = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    flushTimer = null;
    const current = get().scriptRuns[sessionId]?.[scriptId];
    if (current == null || current.runId !== runId || current.status !== 'pending') {
      return;
    }
    writeRun({ record: { ...current, output: stdoutBuffer.replace(ANSI_PATTERN, '') } });
  };

  unlistenOutput = await listenScriptOutput((payload) => {
    if (payload.runId !== runId) {
      return;
    }
    const body = isTruncated ? stdoutBuffer.slice(TRUNCATED_PREFIX.length) : stdoutBuffer;
    const next = body + atob(payload.data);
    const isOverCap = next.length > STDOUT_CAP;
    stdoutBuffer = isOverCap
      ? TRUNCATED_PREFIX + next.slice(-(STDOUT_CAP - TRUNCATED_PREFIX.length))
      : next;
    isTruncated = isTruncated || isOverCap;
    if (flushTimer === null) {
      flushTimer = setTimeout(flush, OUTPUT_FLUSH_MS);
    }
  });

  unlistenExit = await listenScriptExit((payload) => {
    if (payload.runId !== runId) {
      return;
    }
    unlistenExit();
    unlistenOutput();
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const current = get().scriptRuns[sessionId]?.[scriptId];
    if (current == null || current.runId !== runId) {
      return;
    }
    const stdout = stdoutBuffer.replace(ANSI_PATTERN, '');
    const completed: ScriptRunResult = { stdout, stderr: '', exitCode: payload.exitCode };
    writeRun({
      record: {
        status:
          current.status === 'cancelled' ? 'cancelled' : payload.exitCode === 0 ? 'ok' : 'error',
        result: completed,
        runId,
        startedAt,
        ...(name === undefined ? {} : { name }),
      },
    });
    resolveResult?.(completed);
  });

  return {
    result,
    dispose: () => {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
      }
      unlistenExit();
      unlistenOutput();
    },
  };
};
