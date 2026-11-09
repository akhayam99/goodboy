import { useEffect, useMemo, useState } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import {
  ensure,
  isWorktreeStatusSettled,
  readWorktreeStatus,
  subscribe,
  worktreeStatusKey,
} from '../../../../store/runtime/worktreeStatuses/cache';

type Params = {
  readonly targets: ReadonlyArray<{
    readonly worktreePath: string;
    readonly baseBranch?: string;
  }>;
};

type Snapshot = {
  readonly statuses: ReadonlyMap<string, WorktreeStatus>;
  readonly pending: ReadonlySet<string>;
};

const MAX_AGE_MS = 10_000;
const EMPTY_STATUSES: ReadonlyMap<string, WorktreeStatus> = new Map();
const EMPTY_PENDING: ReadonlySet<string> = new Set();
const EMPTY_SNAPSHOT: Snapshot = { statuses: EMPTY_STATUSES, pending: EMPTY_PENDING };

const sameStatuses = (
  current: ReadonlyMap<string, WorktreeStatus>,
  next: ReadonlyMap<string, WorktreeStatus>,
): boolean =>
  current.size === next.size &&
  Array.from(next.entries()).every(([path, value]) => current.get(path) === value);

const samePending = (current: ReadonlySet<string>, next: ReadonlySet<string>): boolean =>
  current.size === next.size && Array.from(next).every((path) => current.has(path));

type SameKeysParams = {
  readonly current: ReadonlyMap<string, string>;
  readonly next: ReadonlyMap<string, string>;
};

const sameKeys = ({ current, next }: SameKeysParams): boolean =>
  current.size === next.size &&
  Array.from(next.entries()).every(([path, key]) => current.get(path) === key);

type Published = Snapshot & {
  readonly keys: ReadonlyMap<string, string>;
};

const EMPTY_KEYS: ReadonlyMap<string, string> = new Map();
const EMPTY_PUBLISHED: Published = { ...EMPTY_SNAPSHOT, keys: EMPTY_KEYS };

type ShownParams = {
  readonly published: Published;
  readonly currentKeys: ReadonlyMap<string, string>;
};

const shownOf = ({ published, currentKeys }: ShownParams): Snapshot => {
  const movedPaths = Array.from(published.statuses.keys()).filter(
    (path) => published.keys.get(path) !== currentKeys.get(path),
  );
  if (movedPaths.length === 0) {
    return published;
  }
  const statuses = new Map(published.statuses);
  const pending = new Set(published.pending);
  movedPaths.forEach((path) => {
    statuses.delete(path);
    if (currentKeys.has(path)) {
      pending.add(path);
    }
  });
  return { statuses, pending };
};

export const useWorktreeStatusSnapshot = ({ targets }: Params): Snapshot => {
  const [published, setPublished] = useState<Published>(EMPTY_PUBLISHED);
  const targetsKey = JSON.stringify(
    targets.map(({ worktreePath, baseBranch }) => [worktreePath, baseBranch ?? null]),
  );
  const stableTargets = useMemo(() => targets, [targetsKey]);
  const currentKeys = useMemo(
    () => new Map(stableTargets.map((target) => [target.worktreePath, worktreeStatusKey(target)])),
    [stableTargets],
  );
  const snapshot = useMemo(() => shownOf({ published, currentKeys }), [published, currentKeys]);

  useEffect(() => {
    if (stableTargets.length === 0) {
      setPublished(EMPTY_PUBLISHED);
      return;
    }
    let isStale = false;
    const keyed = stableTargets.map((target) => ({
      worktreePath: target.worktreePath,
      baseBranch: target.baseBranch,
      key: worktreeStatusKey(target),
    }));
    const publish = () => {
      if (isStale) {
        return;
      }
      const statuses = new Map<string, WorktreeStatus>();
      const nextKeys = new Map<string, string>();
      const pending = new Set<string>();
      keyed.forEach(({ key, worktreePath }) => {
        const value = readWorktreeStatus(key);
        if (value) {
          statuses.set(worktreePath, value);
          nextKeys.set(worktreePath, key);
        }
        if (!isWorktreeStatusSettled(key)) {
          pending.add(worktreePath);
        }
      });
      const isWholeSetRead = pending.size === 0;
      setPublished((current) => {
        const isSameSet =
          sameStatuses(current.statuses, statuses) &&
          sameKeys({ current: current.keys, next: nextKeys });
        const isKept = !isWholeSetRead || isSameSet;
        const nextStatuses = isKept ? current.statuses : statuses;
        const nextPending = samePending(current.pending, pending) ? current.pending : pending;
        return nextStatuses === current.statuses && nextPending === current.pending
          ? current
          : {
              statuses: nextStatuses,
              pending: nextPending,
              keys: isKept ? current.keys : nextKeys,
            };
      });
    };
    const unsubscribes = keyed.map(({ key, worktreePath, baseBranch }) => {
      const pending = ensure({ key, worktreePath, baseBranch, maxAgeMs: MAX_AGE_MS });
      const unsubscribe = subscribe({ key, listener: publish });
      void pending.then(publish);
      return unsubscribe;
    });
    publish();
    return () => {
      isStale = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [stableTargets]);

  return snapshot;
};

export const useWorktreeStatuses = ({ targets }: Params): ReadonlyMap<string, WorktreeStatus> =>
  useWorktreeStatusSnapshot({ targets }).statuses;
