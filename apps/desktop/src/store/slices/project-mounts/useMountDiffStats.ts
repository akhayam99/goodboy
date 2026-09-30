import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { worktreeChangedFiles } from '../../../features/worktree/worktree';
import { readMockMountDiffStat } from '../../mock-data';
import { useAppStore } from '../../store';
import { useSessionLastTurnFinishedAt } from '../agents/selectors';
import { selectMountBaseBranch } from './selectors';

export type MountDiffStat = {
  readonly additions: number;
  readonly deletions: number;
};

const EMPTY_MOUNT_DIFF_STATS: ReadonlyMap<string, MountDiffStat> = new Map();
const MOUNT_DIFF_POLL_MS = 30_000;

let mountDiffTick = 0;
let mountDiffTimer: number | null = null;
const mountDiffTickListeners = new Set<() => void>();

const bumpMountDiffTick = (): void => {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return;
  }
  mountDiffTick += 1;
  for (const listener of mountDiffTickListeners) {
    listener();
  }
};

const readMountDiffTick = (): number => mountDiffTick;

const subscribeMountDiffTick = (listener: () => void): (() => void) => {
  mountDiffTickListeners.add(listener);
  if (mountDiffTimer === null && typeof window !== 'undefined') {
    mountDiffTimer = window.setInterval(bumpMountDiffTick, MOUNT_DIFF_POLL_MS);
    document.addEventListener('visibilitychange', bumpMountDiffTick);
  }
  return () => {
    mountDiffTickListeners.delete(listener);
    if (mountDiffTickListeners.size > 0 || mountDiffTimer === null) {
      return;
    }
    window.clearInterval(mountDiffTimer);
    mountDiffTimer = null;
    document.removeEventListener('visibilitychange', bumpMountDiffTick);
  };
};

const inFlightMountDiffStats = new Map<string, Promise<MountDiffStat>>();

type LoadMountDiffStatParams = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly revision: string;
};

const loadMountDiffStat = ({
  worktreePath,
  baseBranch,
  revision,
}: LoadMountDiffStatParams): Promise<MountDiffStat> => {
  const mocked = readMockMountDiffStat(worktreePath);
  if (mocked !== null) {
    return Promise.resolve(mocked);
  }
  const key = `${revision}@${worktreePath}@${baseBranch ?? ''}`;
  const pending = inFlightMountDiffStats.get(key);
  if (pending !== undefined) {
    return pending;
  }
  const request = worktreeChangedFiles({ worktreePath, baseBranch })
    .then((summary) => ({ additions: summary.additions, deletions: summary.deletions }))
    .catch(() => ({ additions: 0, deletions: 0 }));
  inFlightMountDiffStats.set(key, request);
  void request.finally(() => {
    inFlightMountDiffStats.delete(key);
  });
  return request;
};

type MountStatTarget = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
};

const EMPTY_MOUNT_TARGET_CELLS: ReadonlyArray<string | null> = [];

const decodeMountTargets = (
  cells: ReadonlyArray<string | null>,
): ReadonlyArray<MountStatTarget> => {
  const targets: MountStatTarget[] = [];
  for (let index = 0; index + 1 < cells.length; index += 2) {
    const worktreePath = cells[index];
    if (worktreePath != null) {
      targets.push({ worktreePath, baseBranch: cells[index + 1] ?? null });
    }
  }
  return targets;
};

export const useMountDiffStats = (
  sessionId: SessionId | null,
): ReadonlyMap<string, MountDiffStat> => {
  const targetCells = useAppStore(
    useShallow((s) => {
      if (sessionId == null) {
        return EMPTY_MOUNT_TARGET_CELLS;
      }
      const rows = s.sessionWorktreeRecords?.[sessionId];
      if (rows == null || rows.length === 0) {
        return EMPTY_MOUNT_TARGET_CELLS;
      }
      return rows.flatMap((row): ReadonlyArray<string | null> =>
        row.worktreePath === ''
          ? []
          : [
              row.worktreePath,
              selectMountBaseBranch({ state: s, sessionId, path: row.worktreePath }),
            ],
      );
    }),
  );
  const targets = useMemo(() => decodeMountTargets(targetCells), [targetCells]);
  const lastTurnFinishedAt = useSessionLastTurnFinishedAt(sessionId);
  const summarizerLastUpdate = useAppStore((s) =>
    sessionId == null ? null : (s.summarizerStatus[sessionId]?.lastUpdate ?? null),
  );

  const tick = useSyncExternalStore(subscribeMountDiffTick, readMountDiffTick, readMountDiffTick);

  const [stats, setStats] = useState<ReadonlyMap<string, MountDiffStat>>(EMPTY_MOUNT_DIFF_STATS);

  useEffect(() => {
    if (targets.length === 0) {
      setStats(EMPTY_MOUNT_DIFF_STATS);
      return;
    }
    const revision = `${String(lastTurnFinishedAt)}|${String(summarizerLastUpdate)}|${tick}`;
    let cancelled = false;
    void Promise.all(
      targets.map(async ({ worktreePath, baseBranch }) => {
        const stat = await loadMountDiffStat({ worktreePath, baseBranch, revision });
        return [worktreePath, stat] satisfies readonly [string, MountDiffStat];
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      setStats(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [targets, lastTurnFinishedAt, summarizerLastUpdate, tick]);

  return stats;
};
