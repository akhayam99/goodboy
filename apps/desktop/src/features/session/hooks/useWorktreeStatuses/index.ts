import { useEffect, useMemo, useState } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import { ensure, readWorktreeStatus, subscribe, worktreeStatusKey } from './cache';

type Params = {
  readonly targets: ReadonlyArray<{
    readonly worktreePath: string;
    readonly baseBranch?: string;
  }>;
};

const MAX_AGE_MS = 10_000;
const EMPTY_STATUSES: ReadonlyMap<string, WorktreeStatus> = new Map();

export const useWorktreeStatuses = ({ targets }: Params): ReadonlyMap<string, WorktreeStatus> => {
  const [statuses, setStatuses] = useState<ReadonlyMap<string, WorktreeStatus>>(EMPTY_STATUSES);
  const targetsKey = targets
    .map(({ worktreePath, baseBranch }) => `${worktreePath} ${baseBranch ?? ''}`)
    .join('|');
  const stableTargets = useMemo(() => targets, [targetsKey]);

  useEffect(() => {
    if (stableTargets.length === 0) {
      setStatuses(EMPTY_STATUSES);
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
      const next = new Map<string, WorktreeStatus>();
      keyed.forEach(({ key, worktreePath }) => {
        const value = readWorktreeStatus(key);
        if (value) {
          next.set(worktreePath, value);
        }
      });
      setStatuses((current) => {
        const isSame =
          current.size === next.size &&
          Array.from(next.entries()).every(([path, value]) => current.get(path) === value);
        return isSame ? current : next;
      });
    };
    setStatuses(EMPTY_STATUSES);
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

  return statuses;
};
