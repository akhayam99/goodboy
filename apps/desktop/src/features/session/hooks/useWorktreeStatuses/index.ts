import { useEffect, useMemo, useState } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import {
  ensure,
  isWorktreeStatusSettled,
  readWorktreeStatus,
  subscribe,
  worktreeStatusKey,
} from './cache';

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

const useWorktreeStatusSnapshot = ({ targets }: Params): Snapshot => {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const targetsKey = JSON.stringify(
    targets.map(({ worktreePath, baseBranch }) => [worktreePath, baseBranch ?? null]),
  );
  const stableTargets = useMemo(() => targets, [targetsKey]);

  useEffect(() => {
    if (stableTargets.length === 0) {
      setSnapshot(EMPTY_SNAPSHOT);
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
      const pending = new Set<string>();
      keyed.forEach(({ key, worktreePath }) => {
        const value = readWorktreeStatus(key);
        if (value) {
          statuses.set(worktreePath, value);
        }
        if (!isWorktreeStatusSettled(key)) {
          pending.add(worktreePath);
        }
      });
      setSnapshot((current) =>
        sameStatuses(current.statuses, statuses) && samePending(current.pending, pending)
          ? current
          : { statuses, pending },
      );
    };
    setSnapshot(EMPTY_SNAPSHOT);
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

export const useWorktreeStatusPending = ({ targets }: Params): ReadonlySet<string> =>
  useWorktreeStatusSnapshot({ targets }).pending;
