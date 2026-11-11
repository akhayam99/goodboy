import type { MountId } from '@goodboy/types';
import type { MountRowView } from '../../store/slices/project-mounts/mountRowModel';
import type { BranchGroup, BranchGroupHead } from './branchGroupsOf';

export type BranchGroupOrder = Readonly<{
  shown: ReadonlyArray<BranchGroup>;
  finished: ReadonlyArray<BranchGroup>;
}>;

type Params = {
  readonly groups: ReadonlyArray<BranchGroup>;
  readonly mounts: ReadonlyArray<MountRowView>;
};

type HeadParams = {
  readonly head: BranchGroupHead;
};

type GroupParams = {
  readonly group: BranchGroup;
  readonly mounts: ReadonlyArray<MountRowView>;
};

type RankedGroup = Readonly<{
  group: BranchGroup;
  tier: number;
  lastActiveAt: number;
}>;

const FINISHED_TIER = 3;

const headMountIdsOf = ({ head }: HeadParams): ReadonlyArray<MountId> => {
  if (head.kind === 'branch') {
    return [head.branch.mountId];
  }
  if (head.kind === 'series') {
    return head.parts.map((part) => part.mountId);
  }
  return [];
};

const isRequestClosedOf = ({ group, mounts }: GroupParams): boolean => {
  const mountIds = headMountIdsOf({ head: group.head });
  return (
    mountIds.length > 0 &&
    mountIds.every((mountId) => mounts.find((row) => row.mountId === mountId)?.isFinished === true)
  );
};

const tierOf = ({ group, mounts }: GroupParams): number => {
  if (group.counts.needsYou > 0) {
    return 0;
  }
  if (group.counts.running > 0) {
    return 1;
  }
  const hasLiveRun = group.runs.some((run) => !run.isFinished && !run.isArchived);
  const isClosed = group.isGone || isRequestClosedOf({ group, mounts });
  return isClosed && !hasLiveRun ? FINISHED_TIER : 2;
};

type ActivityParams = {
  readonly group: BranchGroup;
};

const lastActiveAtOf = ({ group }: ActivityParams): number =>
  group.runs.reduce((latest, run) => Math.max(latest, run.startedAt), 0);

export const branchGroupOrderOf = ({ groups, mounts }: Params): BranchGroupOrder => {
  const ranked: ReadonlyArray<RankedGroup> = groups
    .map((group) => ({
      group,
      tier: tierOf({ group, mounts }),
      lastActiveAt: lastActiveAtOf({ group }),
    }))
    .sort((left, right) =>
      left.tier === right.tier ? right.lastActiveAt - left.lastActiveAt : left.tier - right.tier,
    );
  return {
    shown: ranked.filter((entry) => entry.tier < FINISHED_TIER).map((entry) => entry.group),
    finished: ranked.filter((entry) => entry.tier === FINISHED_TIER).map((entry) => entry.group),
  };
};
