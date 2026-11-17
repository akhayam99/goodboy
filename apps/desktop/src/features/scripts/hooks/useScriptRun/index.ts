import { useCallback } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import type { RunnableScript } from '../../buildSessionScripts';
import type { ScriptRunRecord, ScriptRunResult, ScriptRunStatus } from '../../scripts';
import { startRunnableScript } from '../../startRunnableScript';

type Target = {
  readonly script: RunnableScript;
  readonly mountId: MountId;
  readonly worktreePath: string;
};

type Params = {
  readonly sessionId: SessionId;
  readonly scriptKey: string;
  readonly mountId: MountId | null;
  readonly target: Target | null;
};

export type ScriptRun = {
  readonly record: ScriptRunRecord | null;
  readonly status: ScriptRunStatus;
  readonly isRunning: boolean;
  readonly elapsedMs: number | null;
  readonly result: ScriptRunResult | null;
  readonly canRun: boolean;
  readonly run: () => void;
  readonly stop: () => void;
};

type ElapsedParams = {
  readonly record: ScriptRunRecord | null;
  readonly now: number;
};

const elapsedOf = ({ record, now }: ElapsedParams): number | null => {
  if (record === null) {
    return null;
  }
  if (record.status === 'pending') {
    return Math.max(0, now - record.startedAt);
  }
  if (record.completedAt === undefined) {
    return null;
  }
  return Math.max(0, record.completedAt - record.startedAt);
};

export const useScriptRun = ({ sessionId, scriptKey, mountId, target }: Params): ScriptRun => {
  const stored = useAppStore((state) => state.scriptRuns[sessionId]?.[scriptKey] ?? null);
  const record =
    stored === null ||
    mountId === null ||
    stored.mountId === undefined ||
    stored.mountId === mountId
      ? stored
      : null;
  const cancelScript = useAppStore((state) => state.cancelScript);
  const isRunning = record?.status === 'pending';
  const now = useNow(1_000, isRunning);

  const run = useCallback(() => {
    if (target === null || isRunning) {
      return;
    }
    void startRunnableScript({ sessionId, ...target });
  }, [isRunning, sessionId, target]);

  const stop = useCallback(() => {
    if (!isRunning) {
      return;
    }
    void cancelScript(sessionId, scriptKey);
  }, [cancelScript, isRunning, scriptKey, sessionId]);

  return {
    record,
    status: record?.status ?? 'idle',
    isRunning,
    elapsedMs: elapsedOf({ record, now }),
    result: record?.result ?? null,
    canRun: target !== null,
    run,
    stop,
  };
};
