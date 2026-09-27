import { useEffect } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import type { MountRowView } from '../../../../../../store/slices/project-mounts/mountRowModel';

type Params = {
  readonly rows: ReadonlyArray<MountRowView>;
  readonly statusOf: (row: MountRowView) => WorktreeStatus | null;
};

type Target = {
  readonly row: MountRowView;
  readonly head: string;
  readonly mergedHead: string;
};

const targetOf = ({
  row,
  status,
}: {
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
}): Target | null => {
  const mergedHead = row.request?.mergedHeadSha ?? null;
  const head = status?.head ?? null;
  if (row.projectKind !== 'repo' || row.branch === '' || mergedHead === null || head === null) {
    return null;
  }
  return { row, head, mergedHead };
};

export const useMergedThen = ({ rows, statusOf }: Params) => {
  const mergedThen = useAppStore((state) => state.mergedThen);
  const checkMergedThen = useAppStore((state) => state.checkMergedThen);
  const targets = rows.flatMap((row) => {
    const target = targetOf({ row, status: statusOf(row) });
    return target === null ? [] : [target];
  });
  const signature = targets
    .map((target) => `${target.row.mountId}:${target.head}:${target.mergedHead}`)
    .join('|');
  useEffect(() => {
    for (const { row, head, mergedHead } of targets) {
      void checkMergedThen({
        mountId: row.mountId,
        repoRoot: row.worktreePath ?? row.repoRoot,
        branch: row.branch,
        baseBranch: row.baseBranch,
        head,
        mergedHead,
      });
    }
  }, [signature, checkMergedThen]);
  return (row: MountRowView): number | null => {
    const target = targetOf({ row, status: statusOf(row) });
    const entry = mergedThen[row.mountId];
    if (
      target === null ||
      entry === undefined ||
      entry.head !== target.head ||
      entry.mergedHead !== target.mergedHead ||
      entry.newCommits === 0
    ) {
      return null;
    }
    return entry.newCommits;
  };
};
