import { useCallback, useEffect, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
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

const TICK_MS = 1_000;

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

export const useScriptRun = ({ sessionId, scriptKey, target }: Params): ScriptRun => {
  const record = useAppStore((state) => state.scriptRuns[sessionId]?.[scriptKey] ?? null);
  const cancelScript = useAppStore((state) => state.cancelScript);
  const isRunning = record?.status === 'pending';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [isRunning]);

  const run = useCallback(() => {
    if (target === null || isRunning) {
      return;
    }
    void startRunnableScript({ sessionId, ...target });
  }, [isRunning, sessionId, target]);

  const stop = useCallback(() => {
    void cancelScript(sessionId, scriptKey);
  }, [cancelScript, scriptKey, sessionId]);

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
