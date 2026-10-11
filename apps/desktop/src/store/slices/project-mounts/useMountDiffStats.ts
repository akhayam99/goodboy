import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { readMockMountDiffStat } from '../../mock-data';
import { useAppStore } from '../../store';
import { loadMountChangedFiles } from './loadMountChangedFiles';
import { selectMountBaseBranch } from './selectors';
import { useMountDiffRevision } from './useMountDiffRevision';

export type MountDiffStat = {
  readonly additions: number;
  readonly deletions: number;
};

const EMPTY_MOUNT_DIFF_STATS: ReadonlyMap<string, MountDiffStat> = new Map();

type LoadMountDiffStatParams = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly revision: string;
};

const NO_MOUNT_DIFF_STAT: MountDiffStat = { additions: 0, deletions: 0 };

const loadMountDiffStat = async ({
  worktreePath,
  baseBranch,
  revision,
}: LoadMountDiffStatParams): Promise<MountDiffStat> => {
  const mocked = readMockMountDiffStat(worktreePath);
  if (mocked !== null) {
    return mocked;
  }
  const summary = await loadMountChangedFiles({ worktreePath, baseBranch, revision });
  if (summary === null) {
    return NO_MOUNT_DIFF_STAT;
  }
  return { additions: summary.additions, deletions: summary.deletions };
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
  const revision = useMountDiffRevision(sessionId);

  const [stats, setStats] = useState<ReadonlyMap<string, MountDiffStat>>(EMPTY_MOUNT_DIFF_STATS);

  useEffect(() => {
    if (targets.length === 0) {
      setStats(EMPTY_MOUNT_DIFF_STATS);
      return;
    }
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
  }, [targets, revision]);

  return stats;
};
