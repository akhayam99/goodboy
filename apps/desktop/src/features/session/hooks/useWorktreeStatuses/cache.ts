import type { WorktreeStatus } from '@goodboy/types';
import { worktreeStatus } from '../../../worktree/worktree';

type CacheEntry = {
  value: WorktreeStatus | null;
  fetchedAt: number;
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

export const REFRESH_MS = 30_000;

const MAX_CONCURRENT = 4;

const entries = new Map<string, CacheEntry>();

let running = 0;
const queue: Array<() => void> = [];
let timer: ReturnType<typeof setInterval> | null = null;

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

const fetchInto = (entry: CacheEntry): Promise<void> => {
  if (entry.inflight) {
    return entry.inflight;
  }
  const inflight = schedule(() =>
    worktreeStatus({ worktreePath: entry.worktreePath, baseBranch: entry.baseBranch }),
  )
    .then((status) => {
      entry.value = status;
    })
    .catch(() => {
      entry.value = null;
    })
    .finally(() => {
      entry.fetchedAt = Date.now();
      entry.inflight = null;
      notify(entry);
    });
  entry.inflight = inflight;
  return inflight;
};

const startTimer = () => {
  if (timer !== null || typeof setInterval !== 'function') {
    return;
  }
  timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    entries.forEach((entry) => {
      if (entry.listeners.size > 0) {
        void fetchInto(entry);
      }
    });
  }, REFRESH_MS);
};

const stopTimerWhenIdle = () => {
  if (timer === null) {
    return;
  }
  const hasListener = Array.from(entries.values()).some((entry) => entry.listeners.size > 0);
  if (hasListener) {
    return;
  }
  clearInterval(timer);
  timer = null;
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
  await fetchInto(entry);
  return entry.value;
};

export const resetWorktreeStatusCache = () => {
  entries.clear();
  queue.length = 0;
  running = 0;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
};
