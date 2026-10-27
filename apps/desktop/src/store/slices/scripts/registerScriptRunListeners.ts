import type { MountId, SessionId } from '@goodboy/types';
import {
  invokeScriptSnapshot,
  listenScriptExit,
  listenScriptOutput,
  type ScriptRunRecord,
  type ScriptRunResult,
} from '../../../features/scripts/scripts';
import { collapseCarriageReturns } from '../../../features/scripts/collapseCarriageReturns';
import { dispatchWindowEvent } from '../../../shared/lib/dispatchWindowEvent';
import { base64Bytes } from '../../../shared/utils/base64Bytes';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly scriptId: string;
  readonly runId: string;
  readonly startedAt: number;
  readonly name?: string;
  readonly mountId?: MountId;
  readonly shouldReplay?: boolean;
};

type OutputChunk = {
  readonly bytes: Uint8Array;
  readonly offset: number;
};

type WriteRunParams = {
  readonly record: ScriptRunRecord;
};

type FinishParams = {
  readonly exitCode: number;
  readonly isLive: boolean;
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
  mountId,
  shouldReplay = false,
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
  const decoder = new TextDecoder('utf-8');
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

  let isReplaying = shouldReplay;
  let snapshotEnd: number | null = null;
  let pendingExitCode: number | null = null;
  const pendingChunks: OutputChunk[] = [];

  const append = (text: string): void => {
    const body = isTruncated ? stdoutBuffer.slice(TRUNCATED_PREFIX.length) : stdoutBuffer;
    const next = collapseCarriageReturns({ text: body + text });
    const isOverCap = next.length > STDOUT_CAP;
    stdoutBuffer = isOverCap
      ? TRUNCATED_PREFIX + next.slice(-(STDOUT_CAP - TRUNCATED_PREFIX.length))
      : next;
    isTruncated = isTruncated || isOverCap;
    if (flushTimer === null) {
      flushTimer = setTimeout(flush, OUTPUT_FLUSH_MS);
    }
  };

  const decode = ({ bytes }: Pick<OutputChunk, 'bytes'>): string =>
    decoder.decode(bytes, { stream: true });

  const applyChunk = ({ bytes, offset }: OutputChunk): void => {
    if (snapshotEnd === null) {
      append(decode({ bytes }));
      return;
    }
    const skip = snapshotEnd - offset;
    if (skip >= bytes.length) {
      return;
    }
    append(decode({ bytes: skip > 0 ? bytes.subarray(skip) : bytes }));
  };

  const finishRun = ({ exitCode, isLive }: FinishParams): void => {
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
    append(decoder.decode());
    const stdout = stdoutBuffer.replace(ANSI_PATTERN, '');
    const completed: ScriptRunResult = { stdout, stderr: '', exitCode };
    const wasStopped = current.status === 'cancelled';
    writeRun({
      record: {
        status: current.status === 'cancelled' ? 'cancelled' : exitCode === 0 ? 'ok' : 'error',
        result: completed,
        runId,
        startedAt,
        completedAt: Date.now(),
        ...(name === undefined ? {} : { name }),
        ...(mountId === undefined ? {} : { mountId }),
      },
    });
    if (isLive && !wasStopped) {
      dispatchWindowEvent({
        name: 'goodboy:script-ended',
        detail: { sessionId, scriptKey: scriptId, runId },
      });
    }
    resolveResult?.(completed);
  };

  unlistenOutput = await listenScriptOutput((payload) => {
    if (payload.runId !== runId) {
      return;
    }
    const chunk = { bytes: base64Bytes({ data: payload.data }), offset: payload.offset };
    if (isReplaying) {
      pendingChunks.push(chunk);
      return;
    }
    applyChunk(chunk);
  });

  unlistenExit = await listenScriptExit((payload) => {
    if (payload.runId !== runId) {
      return;
    }
    if (isReplaying) {
      pendingExitCode = payload.exitCode;
      return;
    }
    finishRun({ exitCode: payload.exitCode, isLive: true });
  });

  if (shouldReplay) {
    let snapshotExitCode: number | null = null;
    try {
      const snapshot = await invokeScriptSnapshot(runId);
      const bytes = base64Bytes({ data: snapshot.data });
      snapshotEnd = snapshot.offset + bytes.length;
      append(decode({ bytes }));
      snapshotExitCode = snapshot.exitCode;
    } finally {
      isReplaying = false;
      for (const chunk of pendingChunks.splice(0)) {
        applyChunk(chunk);
      }
    }
    const exitCode = pendingExitCode ?? snapshotExitCode;
    if (exitCode !== null) {
      finishRun({ exitCode, isLive: pendingExitCode !== null });
    }
  }

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
