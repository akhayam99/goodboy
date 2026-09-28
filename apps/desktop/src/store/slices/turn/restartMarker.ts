import { getSetting, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { RestartReason } from './planRestartResume';

export const INTERRUPTED_RUNS_KEY = 'restart.interrupted_runs';
export const RESTART_REASON_KEY = 'restart.reason';

const REASON_WINDOW_MS = 10 * 60 * 1000;

export type InterruptedRuns = {
  readonly runIds: ReadonlySet<string>;
  readonly at: number;
  readonly reason: RestartReason;
};

type StoredRuns = {
  readonly runIds: ReadonlyArray<string>;
  readonly at: number;
};

type StoredReason = {
  readonly reason: RestartReason;
  readonly at: number;
};

const parseJson = ({ raw }: { readonly raw: string | null }): unknown => {
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isStoredRuns = (value: unknown): value is StoredRuns => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.runIds) &&
    candidate.runIds.every((id) => typeof id === 'string') &&
    typeof candidate.at === 'number'
  );
};

const isStoredReason = (value: unknown): value is StoredReason => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.reason === 'update' || candidate.reason === 'restart') &&
    typeof candidate.at === 'number'
  );
};

export const readInterruptedRuns = async (): Promise<InterruptedRuns | null> => {
  const [runsRaw, reasonRaw] = await Promise.all([
    getSetting(tauriDatabase, INTERRUPTED_RUNS_KEY),
    getSetting(tauriDatabase, RESTART_REASON_KEY),
  ]);
  const runs = parseJson({ raw: runsRaw });
  if (!isStoredRuns(runs) || runs.runIds.length === 0) {
    return null;
  }
  const reason = parseJson({ raw: reasonRaw });
  const isUpdate =
    isStoredReason(reason) &&
    reason.reason === 'update' &&
    Math.abs(runs.at - reason.at) <= REASON_WINDOW_MS;
  return { runIds: new Set(runs.runIds), at: runs.at, reason: isUpdate ? 'update' : 'restart' };
};

type TakeParams = {
  readonly marker: InterruptedRuns;
  readonly runIds: ReadonlyArray<string>;
};

export const takeInterruptedRuns = async ({ marker, runIds }: TakeParams): Promise<void> => {
  if (runIds.length === 0) {
    return;
  }
  const current = await readInterruptedRuns();
  const base = current ?? marker;
  const taken = new Set(runIds);
  const remaining = [...base.runIds].filter((id) => !taken.has(id));
  const value: StoredRuns = { runIds: remaining, at: base.at };
  await setSetting(tauriDatabase, INTERRUPTED_RUNS_KEY, JSON.stringify(value));
};

export const writeRestartReason = async ({
  reason,
}: {
  readonly reason: RestartReason;
}): Promise<void> => {
  const value: StoredReason = { reason, at: Date.now() };
  await setSetting(tauriDatabase, RESTART_REASON_KEY, JSON.stringify(value));
};

export const readRecentRestartReason = async ({
  nowMs,
}: {
  readonly nowMs: number;
}): Promise<RestartReason | null> => {
  const reason = parseJson({ raw: await getSetting(tauriDatabase, RESTART_REASON_KEY) });
  if (!isStoredReason(reason) || nowMs - reason.at > REASON_WINDOW_MS) {
    return null;
  }
  return reason.reason;
};
