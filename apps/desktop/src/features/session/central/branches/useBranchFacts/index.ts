import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { branchPushStateOf } from '../../../../../shared/lib/branchPushState';
import { changedCount, distanceAhead, mainBehindOf } from '../../../../../shared/lib/gitStatus';
import { useMountRows } from '../../../../../shared/hooks/useMountRows';
import { useSessionMountHosts } from '../../../../../shared/hooks/useSessionMountHosts';
import { useWorktreeStatuses } from '../../../hooks/useWorktreeStatuses';
import type { LiveGroupModel } from '../../now/liveGroupsOf';
import { branchFactsOf, type BranchFacts, type BranchStatusFacts } from '../branchFactsOf';

type Params = {
  readonly sessionId: SessionId;
  readonly groups: ReadonlyArray<LiveGroupModel>;
};

type Result = {
  readonly facts: ReadonlyArray<BranchFacts>;
};

export const useBranchFacts = ({ sessionId, groups }: Params): Result => {
  const mountGroups = useMountRows({ sessionId });
  const { mountGithub, mountRequests } = useSessionMountHosts({ sessionId });
  const rows = useMemo(() => mountGroups.flatMap((group) => group.rows), [mountGroups]);
  const finishedRows = useMemo(
    () => mountGroups.flatMap((group) => group.finishedRows),
    [mountGroups],
  );
  const targets = useMemo(
    () =>
      rows.flatMap((row) =>
        row.worktreePath === null
          ? []
          : [{ worktreePath: row.worktreePath, baseBranch: row.baseBranch ?? undefined }],
      ),
    [rows],
  );
  const statuses = useWorktreeStatuses({ targets });
  const facts = useMemo(() => {
    const fetchedAtByMountId = new Map<string, string | null>();
    const behindByMountId = new Map<string, number | null>();
    const statusByMountId = new Map<string, BranchStatusFacts>();
    const liveCountByMountId = new Map<string, number>();
    const liveTitleByMountId = new Map<string, string>();
    for (const row of [...rows, ...finishedRows]) {
      fetchedAtByMountId.set(
        row.mountId,
        mountGithub?.[row.mountId]?.fetchedAt ?? mountRequests?.[row.mountId]?.fetchedAt ?? null,
      );
      const status = row.worktreePath === null ? undefined : statuses.get(row.worktreePath);
      behindByMountId.set(row.mountId, mainBehindOf({ status, isDone: row.isFinished }));
      if (status !== undefined) {
        statusByMountId.set(row.mountId, {
          ahead: distanceAhead({ distance: status.mainDistance }),
          push: branchPushStateOf({ status }),
          changedFiles: changedCount({ workingTree: status.workingTree }),
          isRebasing: !row.isFinished && status.inProgress === 'rebase',
        });
      }
    }
    for (const group of groups) {
      if (group.mountId !== null) {
        liveCountByMountId.set(group.mountId, (liveCountByMountId.get(group.mountId) ?? 0) + 1);
        if (!liveTitleByMountId.has(group.mountId)) {
          liveTitleByMountId.set(group.mountId, group.title);
        }
      }
    }
    return branchFactsOf({
      rows: [...rows, ...finishedRows],
      fetchedAtByMountId,
      behindByMountId,
      liveCountByMountId,
      liveTitleByMountId,
      statusByMountId,
      now: Date.now(),
    });
  }, [finishedRows, groups, mountGithub, mountRequests, rows, statuses]);
  return { facts };
};
