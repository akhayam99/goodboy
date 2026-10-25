import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import {
  resolveMountBaseBranch,
  selectWritableMounts,
} from '../../../store/slices/project-mounts/selectors';
import {
  ensure,
  readWorktreeStatusRead,
  type WorktreeStatusRead,
  subscribe,
  worktreeStatusKey,
} from '../../../store/runtime/worktreeStatuses/cache';
import { pickKeys } from '../../../shared/utils/pickKeys';
import { rebaseStopOf } from '../rebaseStopOf';
import { rebaseStopRowOf, type RebaseStopRow } from '../rebaseStopRowOf';

type Params = {
  readonly sessionId: SessionId;
};

type RowParams = {
  readonly mountId: string | null;
};

export type RebaseStopRowFor = (params: RowParams) => RebaseStopRow | null;

const MAX_AGE_MS = 10_000;

export const useRebaseStopRows = ({ sessionId }: Params): RebaseStopRowFor => {
  const events = useAppStore((s) => s.sessionEvents?.[sessionId] ?? EMPTY_ARRAY);
  const settled = useAppStore((s) => s.settledRebaseStops[sessionId] ?? EMPTY_ARRAY);
  const views = useAppStore((s) => s.sessionMounts[sessionId]);
  const mounts = useAppStore((s) => s.sessionProjectMounts[sessionId]);
  const projects = useAppStore((s) => s.projects);
  const writable = useMemo(
    () =>
      selectWritableMounts({
        state: {
          sessionMounts: views === undefined ? {} : { [sessionId]: views },
          sessionProjectMounts: mounts === undefined ? {} : { [sessionId]: mounts },
        },
        sessionId,
      }),
    [mounts, sessionId, views],
  );
  const mountIds = useMemo(() => writable.map((mount) => mount.mountId), [writable]);
  const runs = useAppStore(useShallow((s) => pickKeys({ source: s.historyRuns, keys: mountIds })));
  const targets = useMemo(
    () =>
      writable.flatMap((mount) => {
        if (mount.worktreePath === '') {
          return [];
        }
        const baseBranch = resolveMountBaseBranch({ mount, projects }) ?? undefined;
        return [
          {
            key: worktreeStatusKey({ worktreePath: mount.worktreePath, baseBranch }),
            worktreePath: mount.worktreePath,
            baseBranch,
          },
        ];
      }),
    [projects, writable],
  );
  useEffect(() => {
    for (const target of targets) {
      void ensure({ ...target, maxAgeMs: MAX_AGE_MS });
    }
  }, [targets]);
  const watch = useCallback(
    (listener: () => void) => {
      const stops = targets.map((target) => subscribe({ key: target.key, listener }));
      return () => stops.forEach((stop) => stop());
    },
    [targets],
  );
  const readFingerprint = useSyncExternalStore(watch, () =>
    targets.map((target) => readWorktreeStatusRead({ key: target.key })?.readAt ?? 0).join('|'),
  );
  const reads = useMemo(() => {
    const byKey = new Map<string, WorktreeStatusRead | null>();
    for (const target of targets) {
      byKey.set(target.key, readWorktreeStatusRead({ key: target.key }));
    }
    return { fingerprint: readFingerprint, byKey };
  }, [readFingerprint, targets]);
  return useCallback(
    ({ mountId }: RowParams): RebaseStopRow | null => {
      const mount = writable.find((candidate) => mountId !== null && candidate.mountId === mountId);
      if (mount === undefined) {
        return null;
      }
      const baseBranch = resolveMountBaseBranch({ mount, projects });
      const stop = rebaseStopOf({
        sessionId,
        mountId: mount.mountId,
        run: runs[mount.mountId],
        events,
        settledStopIds: settled,
        baseBranch: baseBranch ?? 'main',
        read:
          mount.worktreePath === ''
            ? null
            : (reads.byKey.get(
                worktreeStatusKey({
                  worktreePath: mount.worktreePath,
                  baseBranch: baseBranch ?? undefined,
                }),
              ) ?? null),
      });
      return stop === null
        ? null
        : rebaseStopRowOf({ stop, baseBranch: baseBranch ?? 'main', projectName: mount.mountName });
    },
    [events, projects, reads, runs, sessionId, settled, writable],
  );
};
