import type { WorktreeStatus } from '@goodboy/types';
import { startPoll } from '../../../shared/lib/usePoll/startPoll';
import { worktreeStatus } from '../../../features/worktree/worktree';

type CacheEntry = {
  value: WorktreeStatus | null;
  fetchedAt: number;
  readAt: number;
  inflight: Promise<void> | null;
  worktreePath: string;
  baseBranch?: string;
  listeners: Set<() => void>;
};

type EnsureParams = {
  readonly key: string;
  readonly worktreePath: string;
  readonly baseBranch?: string;
  readonly maxAgeMs: number;
};

type SubscribeParams = {
  readonly key: string;
  readonly listener: () => void;
};

const REFRESH_MS = 30_000;

const MAX_CONCURRENT = 4;

const entries = new Map<string, CacheEntry>();

let running = 0;
const queue: Array<() => void> = [];
let stopTimer: (() => void) | null = null;

export const worktreeStatusKey = ({
  worktreePath,
  baseBranch,
}: {
  readonly worktreePath: string;
  readonly baseBranch?: string;
}): string => JSON.stringify([worktreePath, baseBranch ?? null]);

const entryFor = ({
  key,
  worktreePath,
  baseBranch,
}: {
  readonly key: string;
  readonly worktreePath: string;
  readonly baseBranch?: string;
}): CacheEntry => {
  const existing = entries.get(key);
  if (existing) {
    return existing;
  }
  const created: CacheEntry = {
    value: null,
    fetchedAt: 0,
    readAt: 0,
    inflight: null,
    worktreePath,
    baseBranch,
    listeners: new Set(),
  };
  entries.set(key, created);
  return created;
};

const drain = () => {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift();
    if (next) {
      running += 1;
      next();
    }
  }
};

const schedule = <T>(task: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    queue.push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          running -= 1;
          drain();
        });
    });
    drain();
  });

const notify = (entry: CacheEntry) => {
  entry.listeners.forEach((listener) => listener());
};

type StagedRead = {
  readonly entry: CacheEntry;
  readonly value: WorktreeStatus | null;
  readonly readAt: number;
  readonly fetchedAt: number;
};

type Batch = {
  isOpen: boolean;
  unfinished: number;
  readonly staged: Array<StagedRead>;
  readonly landed: Promise<void>;
  readonly land: () => void;
};

let generation = 0;
let openBatch: Batch | null = null;

const createBatch = (): Batch => {
  let land = () => {};
  const landed = new Promise<void>((resolve) => {
    land = resolve;
  });
  return { isOpen: true, unfinished: 0, staged: [], landed, land };
};

const joinBatch = (): Batch => {
  if (openBatch !== null && openBatch.isOpen) {
    return openBatch;
  }
  openBatch = createBatch();
  return openBatch;
};

type CommitParams = {
  readonly batch: Batch;
};

const commit = ({ batch }: CommitParams) => {
  batch.staged.forEach(({ entry, value, readAt, fetchedAt }) => {
    entry.value = value;
    entry.readAt = readAt;
    entry.fetchedAt = fetchedAt;
    entry.inflight = null;
  });
  batch.staged.forEach(({ entry }) => notify(entry));
  batch.land();
};

type FinishParams = {
  readonly batch: Batch;
  readonly read: StagedRead;
  readonly startedIn: number;
};

const finish = ({ batch, read, startedIn }: FinishParams) => {
  if (startedIn !== generation) {
    batch.land();
    return;
  }
  batch.isOpen = false;
  batch.staged.push(read);
  batch.unfinished -= 1;
  if (batch.unfinished === 0) {
    commit({ batch });
  }
};

const fetchInto = (entry: CacheEntry): Promise<void> => {
  if (entry.inflight) {
    return entry.inflight;
  }
  const requestedAt = Date.now();
  const startedIn = generation;
  const batch = joinBatch();
  batch.unfinished += 1;
  const inflight = schedule(() =>
    worktreeStatus({ worktreePath: entry.worktreePath, baseBranch: entry.baseBranch }),
  )
    .then(
      (status) => ({ value: status, readAt: requestedAt }),
      () => ({ value: null, readAt: 0 }),
    )
    .then(({ value, readAt }) => {
      finish({ batch, read: { entry, value, readAt, fetchedAt: Date.now() }, startedIn });
      return batch.landed;
    });
  entry.inflight = inflight;
  return inflight;
};

const startTimer = () => {
  if (stopTimer !== null || typeof window === 'undefined') {
    return;
  }
  stopTimer = startPoll({
    run: () => {
      entries.forEach((entry) => {
        if (entry.listeners.size > 0) {
          void fetchInto(entry);
        }
      });
    },
    everyMs: REFRESH_MS,
    gate: 'visible',
    isImmediate: false,
  });
};

const stopTimerWhenIdle = () => {
  if (stopTimer === null) {
    return;
  }
  const hasListener = Array.from(entries.values()).some((entry) => entry.listeners.size > 0);
  if (hasListener) {
    return;
  }
  stopTimer();
  stopTimer = null;
};

export const subscribe = ({ key, listener }: SubscribeParams): (() => void) => {
  const entry = entries.get(key);
  if (!entry) {
    return () => {};
  }
  entry.listeners.add(listener);
  startTimer();
  return () => {
    entry.listeners.delete(listener);
    stopTimerWhenIdle();
  };
};

export const readWorktreeStatus = (key: string): WorktreeStatus | null =>
  entries.get(key)?.value ?? null;

export type WorktreeStatusRead = {
  readonly status: WorktreeStatus;
  readonly readAt: number;
};

type ReadParams = {
  readonly key: string;
};

export const readWorktreeStatusRead = ({ key }: ReadParams): WorktreeStatusRead | null => {
  const entry = entries.get(key);
  if (entry === undefined || entry.value === null) {
    return null;
  }
  return { status: entry.value, readAt: entry.readAt };
};

type StatusFreshness = 'any' | { readonly maxAgeMs: number };

type StatusRead =
  | { readonly kind: 'known'; readonly status: WorktreeStatus; readonly readAt: number }
  | { readonly kind: 'unknown'; readonly reason: 'never-read' | 'failed' | 'stale' };

type ReadByKeyParams = {
  readonly key: string;
  readonly freshness: StatusFreshness;
};

export const read = ({ key, freshness }: ReadByKeyParams): StatusRead => {
  const entry = entries.get(key);
  if (entry === undefined || entry.fetchedAt === 0) {
    return { kind: 'unknown', reason: 'never-read' };
  }
  if (entry.value === null) {
    return { kind: 'unknown', reason: 'failed' };
  }
  if (freshness !== 'any' && Date.now() - entry.readAt > freshness.maxAgeMs) {
    return { kind: 'unknown', reason: 'stale' };
  }
  return { kind: 'known', status: entry.value, readAt: entry.readAt };
};

export const isWorktreeStatusSettled = (key: string): boolean =>
  (entries.get(key)?.fetchedAt ?? 0) > 0;

export const ensure = async ({
  key,
  worktreePath,
  baseBranch,
  maxAgeMs,
}: EnsureParams): Promise<WorktreeStatus | null> => {
  const entry = entryFor({ key, worktreePath, baseBranch });
  entry.worktreePath = worktreePath;
  entry.baseBranch = baseBranch;
  const isFresh = entry.fetchedAt > 0 && Date.now() - entry.fetchedAt < maxAgeMs;
  if (isFresh && !entry.inflight) {
    return entry.value;
  }
  if (maxAgeMs <= 0 && entry.inflight) {
    await entry.inflight;
  }
  await fetchInto(entry);
  return entry.value;
};

type ReadNowParams = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
};

export const readWorktreeStatusNow = ({
  worktreePath,
  baseBranch,
}: ReadNowParams): Promise<WorktreeStatus | null> => {
  const base = baseBranch ?? undefined;
  return ensure({
    key: worktreeStatusKey({ worktreePath, baseBranch: base }),
    worktreePath,
    baseBranch: base,
    maxAgeMs: 0,
  });
};

type RefreshParams = {
  readonly worktreePaths: ReadonlyArray<string>;
};

export const refreshWorktreeStatuses = async ({ worktreePaths }: RefreshParams): Promise<void> => {
  const wanted = new Set(worktreePaths);
  await Promise.all(
    Array.from(entries.values())
      .filter((entry) => wanted.has(entry.worktreePath))
      .map((entry) => fetchInto(entry)),
  );
};

export const resetWorktreeStatusCache = () => {
  generation += 1;
  openBatch = null;
  entries.clear();
  queue.length = 0;
  running = 0;
  if (stopTimer !== null) {
    stopTimer();
    stopTimer = null;
  }
};
