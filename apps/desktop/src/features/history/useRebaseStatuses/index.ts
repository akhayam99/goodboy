import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId, SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  ensure,
  readWorktreeStatus,
  subscribe,
} from '../../../store/runtime/worktreeStatuses/cache';
import { unmergedCount } from '../../../shared/lib/gitStatus';
import { pickKeys } from '../../../shared/utils/pickKeys';
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
    : JSON.stringify([
        status.head,
        status.mainDistance,
        status.inProgress ?? null,
        unmergedCount({ workingTree: status.workingTree }),
      ]);

export const useRebaseStatuses = ({
  sessionId,
}: Params): ReadonlyMap<MountId, WorktreeStatus | null> => {
  const mounts = useAppStore((s) => s.sessionProjectMounts[sessionId] ?? NO_MOUNTS);
  const projects = useAppStore((s) => s.projects);
  const settleStaleRebases = useAppStore((s) => s.settleStaleRebases);
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
  const fingerprint = useSyncExternalStore(watch, () =>
    targets.map((target) => fingerprintOf({ status: readWorktreeStatus(target.key) })).join('|'),
  );
  const events = useAppStore((s) => s.sessionEvents?.[sessionId]);
  const mountIds = useMemo(() => mounts.map((mount) => mount.mountId), [mounts]);
  const historyRuns = useAppStore(
    useShallow((s) => pickKeys({ source: s.historyRuns, keys: mountIds })),
  );
  const run = useAppStore((s) => s.rebaseAllRuns[sessionId]);
  useEffect(() => {
    if (fingerprint === '') {
      return;
    }
    settleStaleRebases({ sessionId });
  }, [events, fingerprint, historyRuns, run, sessionId, settleStaleRebases]);
  return new Map(targets.map((target) => [target.mountId, readWorktreeStatus(target.key)]));
};
