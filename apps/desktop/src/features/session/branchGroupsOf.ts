import type { MountId } from '@goodboy/types';
import type { MountRowView } from '../../store/slices/project-mounts/mountRowModel';
import { pullRequestStateWordOf } from '../branch/pullRequestStateWordOf';
import { branchHeadMountIdsOf } from './branchHeadMountIdsOf';
import { runBranchMembershipOf } from './runBranchMembershipOf';
import { runGroupKeyOf } from './runGroupsOf';
import type { SessionRun } from './sessionRunsOf';
import type { WorkBranch } from './workBranchesOf';

export const NO_BRANCH_KEY = 'none';

export type BranchGroupPart = Readonly<{
  mountId: MountId;
  branch: string;
  fact: string | null;
}>;

export type BranchGroupHead = Readonly<
  | { kind: 'branch'; branch: WorkBranch; fact: string | null }
  | { kind: 'series'; name: string; projectName: string; parts: ReadonlyArray<BranchGroupPart> }
  | { kind: 'none' }
>;

export type BranchGroupCounts = Readonly<{
  needsYou: number;
  running: number;
  finished: number;
}>;

export type BranchGroup = Readonly<{
  key: string;
  head: BranchGroupHead;
  runs: ReadonlyArray<SessionRun>;
  counts: BranchGroupCounts;
  isGone: boolean;
}>;

type Params = {
  readonly runs: ReadonlyArray<SessionRun>;
  readonly mounts: ReadonlyArray<MountRowView>;
};

type KeyParams = {
  readonly branch: WorkBranch;
  readonly mounts: ReadonlyArray<MountRowView>;
};

type MountKeyParams = {
  readonly mountId: MountId;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export const branchGroupKeyOfMount = ({ mountId, mounts }: MountKeyParams): string => {
  const row = mounts.find((candidate) => candidate.mountId === mountId);
  return row?.series == null ? `mount:${mountId}` : `series:${row.series.seriesId}`;
};

const keyOfBranch = ({ branch, mounts }: KeyParams): string =>
  branchGroupKeyOfMount({ mountId: branch.mountId, mounts });

type BranchKeysParams = {
  readonly branches: ReadonlyArray<WorkBranch>;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export const branchKeysOf = ({ branches, mounts }: BranchKeysParams): ReadonlyArray<string> => {
  if (branches.length === 0) {
    return [NO_BRANCH_KEY];
  }
  return [...new Set(branches.map((branch) => keyOfBranch({ branch, mounts })))];
};

type CountKeysParams = {
  readonly branchLists: ReadonlyArray<ReadonlyArray<WorkBranch>>;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export const namedBranchGroupCountOf = ({ branchLists, mounts }: CountKeysParams): number =>
  new Set(
    branchLists.flatMap((branches) =>
      branches.map((branch) => branchGroupKeyOfMount({ mountId: branch.mountId, mounts })),
    ),
  ).size;

type FactParams = {
  readonly row: MountRowView | undefined;
};

const requestFactOf = ({ row }: FactParams): string | null => {
  if (row === undefined || row.request === null) {
    return null;
  }
  const word = pullRequestStateWordOf({ state: row.request.state });
  const number = `#${row.request.number}`;
  return word === null ? number : `${number} ${word}`;
};

type HeadParams = {
  readonly key: string;
  readonly branches: ReadonlyArray<WorkBranch>;
  readonly mounts: ReadonlyArray<MountRowView>;
};

const groupHeadOf = ({ key, branches, mounts }: HeadParams): BranchGroupHead => {
  if (key === NO_BRANCH_KEY) {
    return { kind: 'none' };
  }
  const first = branches[0];
  if (first === undefined) {
    return { kind: 'none' };
  }
  const series = mounts.find(
    (row) => row.series !== null && `series:${row.series.seriesId}` === key,
  )?.series;
  if (series == null) {
    return {
      kind: 'branch',
      branch: first,
      fact: requestFactOf({ row: mounts.find((row) => row.mountId === first.mountId) }),
    };
  }
  const parts = mounts
    .filter((row) => row.series?.seriesId === series.seriesId)
    .sort((left, right) => (left.series?.position ?? 0) - (right.series?.position ?? 0))
    .map((row) => ({ mountId: row.mountId, branch: row.branch, fact: requestFactOf({ row }) }));
  return { kind: 'series', name: series.name, projectName: first.projectName, parts };
};

type CountParams = {
  readonly runs: ReadonlyArray<SessionRun>;
};

type ShownCountParams = {
  readonly group: BranchGroup;
};

export const branchGroupShownCountOf = ({ group }: ShownCountParams): number =>
  group.runs.filter((run) => !run.isArchived).length;

export const branchGroupCountsOf = ({ runs }: CountParams): BranchGroupCounts => ({
  needsYou: runs.filter((run) => runGroupKeyOf({ run }) === 'needsYou').length,
  running: runs.filter((run) => runGroupKeyOf({ run }) === 'running').length,
  finished: runs.filter((run) => run.isFinished && !run.isArchived).length,
});

export type BranchEntry<T> = Readonly<{
  item: T;
  branches: ReadonlyArray<WorkBranch>;
}>;

export type BranchKeyedGroup<T> = Readonly<{
  key: string;
  head: BranchGroupHead;
  items: ReadonlyArray<T>;
}>;

type KeyedParams<T> = {
  readonly entries: ReadonlyArray<BranchEntry<T>>;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export const branchKeyedGroupsOf = <T>({
  entries,
  mounts,
}: KeyedParams<T>): ReadonlyArray<BranchKeyedGroup<T>> => {
  const itemsByKey = new Map<string, Array<T>>();
  const branchesByKey = new Map<string, Array<WorkBranch>>();
  for (const { item, branches: itemBranches } of entries) {
    for (const key of branchKeysOf({ branches: itemBranches, mounts })) {
      itemsByKey.set(key, [...(itemsByKey.get(key) ?? []), item]);
      const branches = itemBranches.filter((branch) => keyOfBranch({ branch, mounts }) === key);
      const known = branchesByKey.get(key) ?? [];
      branchesByKey.set(key, [
        ...known,
        ...branches.filter((branch) => !known.some((other) => other.mountId === branch.mountId)),
      ]);
    }
  }
  return [...itemsByKey.entries()].map(([key, items]) => ({
    key,
    head: groupHeadOf({ key, branches: branchesByKey.get(key) ?? [], mounts }),
    items,
  }));
};

type GoneParams = {
  readonly group: BranchKeyedGroup<SessionRun>;
  readonly mounts: ReadonlyArray<MountRowView>;
};

const isGroupGoneOf = ({ group, mounts }: GoneParams): boolean => {
  if (group.key === NO_BRANCH_KEY) {
    return false;
  }
  const hasAttachedRun = group.items.some((run) =>
    run.branches.some((branch) => keyOfBranch({ branch, mounts }) === group.key),
  );
  const hasAttachedMount = branchHeadMountIdsOf({ head: group.head }).some(
    (mountId) => mounts.find((row) => row.mountId === mountId)?.isAttached === true,
  );
  return !hasAttachedRun && !hasAttachedMount;
};

export const branchGroupsOf = ({ runs, mounts }: Params): ReadonlyArray<BranchGroup> =>
  branchKeyedGroupsOf({
    entries: runs.map((run) => ({ item: run, branches: runBranchMembershipOf({ run }) })),
    mounts,
  }).map((group) => ({
    key: group.key,
    head: group.head,
    runs: group.items,
    counts: branchGroupCountsOf({ runs: group.items }),
    isGone: isGroupGoneOf({ group, mounts }),
  }));

type AlsoBranchesParams = {
  readonly branches: ReadonlyArray<WorkBranch>;
  readonly groupKey: string;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export const alsoOnBranchesOf = ({
  branches,
  groupKey,
  mounts,
}: AlsoBranchesParams): ReadonlyArray<WorkBranch> => {
  const seen = new Set<string>([groupKey]);
  return branches.filter((branch) => {
    const key = keyOfBranch({ branch, mounts });
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

type AlsoParams = {
  readonly run: SessionRun;
  readonly groupKey: string;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export const alsoOnOf = ({ run, groupKey, mounts }: AlsoParams): ReadonlyArray<WorkBranch> =>
  alsoOnBranchesOf({ branches: runBranchMembershipOf({ run }), groupKey, mounts });
