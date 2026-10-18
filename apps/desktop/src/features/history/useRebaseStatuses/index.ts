import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { MountId, SessionId, SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  ensure,
  readWorktreeStatus,
  subscribe,
} from '../../../store/slices/worktreeStatuses/cache';
import { rebaseStatusTargetsOf } from '../behindBranchesOf';

type Params = {
  readonly sessionId: SessionId;
};

const MAX_AGE_MS = 10_000;

const NO_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

type FingerprintParams = {
  readonly status: WorktreeStatus | null;
};

const fingerprintOf = ({ status }: FingerprintParams): string =>
  status === null
    ? ''
    : JSON.stringify([status.head, status.mainDistance, status.inProgress ?? null]);

export const useRebaseStatuses = ({
  sessionId,
}: Params): ReadonlyMap<MountId, WorktreeStatus | null> => {
  const mounts = useAppStore((s) => s.sessionProjectMounts[sessionId] ?? NO_MOUNTS);
  const projects = useAppStore((s) => s.projects);
  const targets = useMemo(() => rebaseStatusTargetsOf({ mounts, projects }), [mounts, projects]);

  useEffect(() => {
    for (const target of targets) {
      void ensure({
        key: target.key,
        worktreePath: target.worktreePath,
        baseBranch: target.baseBranch ?? undefined,
        maxAgeMs: MAX_AGE_MS,
      });
    }
  }, [targets]);

  const watch = useCallback(
    (listener: () => void) => {
      const stops = targets.map((target) => subscribe({ key: target.key, listener }));
      return () => stops.forEach((stop) => stop());
    },
    [targets],
  );
  useSyncExternalStore(watch, () =>
    targets.map((target) => fingerprintOf({ status: readWorktreeStatus(target.key) })).join('|'),
  );
  return new Map(targets.map((target) => [target.mountId, readWorktreeStatus(target.key)]));
};
