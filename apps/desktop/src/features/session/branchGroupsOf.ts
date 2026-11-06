import type { MountId } from '@goodboy/types';
import type { MountRowView } from '../../store/slices/project-mounts/mountRowModel';
import { pullRequestStateWordOf } from '../branch/pullRequestStateWordOf';
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
}>;

type Params = {
  readonly runs: ReadonlyArray<SessionRun>;
  readonly mounts: ReadonlyArray<MountRowView>;
};

type KeyParams = {
  readonly branch: WorkBranch;
  readonly mounts: ReadonlyArray<MountRowView>;
};

const keyOfBranch = ({ branch, mounts }: KeyParams): string => {
  const row = mounts.find((candidate) => candidate.mountId === branch.mountId);
  return row?.series == null ? `mount:${branch.mountId}` : `series:${row.series.seriesId}`;
};

type RunKeysParams = {
  readonly run: SessionRun;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export const branchGroupKeysOf = ({ run, mounts }: RunKeysParams): ReadonlyArray<string> => {
  if (run.branches.length === 0) {
    return [NO_BRANCH_KEY];
  }
  return [...new Set(run.branches.map((branch) => keyOfBranch({ branch, mounts })))];
};

type FactParams = {
  readonly row: MountRowView | undefined;
};

const factOf = ({ row }: FactParams): string | null => {
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

const headOf = ({ key, branches, mounts }: HeadParams): BranchGroupHead => {
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
      fact: factOf({ row: mounts.find((row) => row.mountId === first.mountId) }),
    };
  }
  const parts = mounts
    .filter((row) => row.series?.seriesId === series.seriesId)
    .sort((left, right) => (left.series?.position ?? 0) - (right.series?.position ?? 0))
    .map((row) => ({ mountId: row.mountId, branch: row.branch, fact: factOf({ row }) }));
  return { kind: 'series', name: series.name, projectName: first.projectName, parts };
};

type CountParams = {
  readonly runs: ReadonlyArray<SessionRun>;
};

const countsOf = ({ runs }: CountParams): BranchGroupCounts => ({
  needsYou: runs.filter((run) => runGroupKeyOf({ run }) === 'needsYou').length,
  running: runs.filter((run) => runGroupKeyOf({ run }) === 'running').length,
  finished: runs.filter((run) => run.isFinished || run.isArchived).length,
});

export const branchGroupsOf = ({ runs, mounts }: Params): ReadonlyArray<BranchGroup> => {
  const runsByKey = new Map<string, Array<SessionRun>>();
  const branchesByKey = new Map<string, Array<WorkBranch>>();
  for (const run of runs) {
    for (const key of branchGroupKeysOf({ run, mounts })) {
      runsByKey.set(key, [...(runsByKey.get(key) ?? []), run]);
      const branches = run.branches.filter((branch) => keyOfBranch({ branch, mounts }) === key);
      const known = branchesByKey.get(key) ?? [];
      branchesByKey.set(key, [
        ...known,
        ...branches.filter((branch) => !known.some((other) => other.mountId === branch.mountId)),
      ]);
    }
  }
  const groups = [...runsByKey.entries()].map(([key, groupRuns]) => ({
    key,
    head: headOf({ key, branches: branchesByKey.get(key) ?? [], mounts }),
    runs: groupRuns,
    counts: countsOf({ runs: groupRuns }),
  }));
  const named = groups.filter((group) => group.key !== NO_BRANCH_KEY);
  const none = groups.filter((group) => group.key === NO_BRANCH_KEY);
  const needing = named.filter((group) => group.counts.needsYou > 0);
  const rest = named.filter((group) => group.counts.needsYou === 0);
  return [...needing, ...rest, ...none];
};

type AlsoParams = {
  readonly run: SessionRun;
  readonly groupKey: string;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export const alsoOnOf = ({ run, groupKey, mounts }: AlsoParams): ReadonlyArray<WorkBranch> => {
  const seen = new Set<string>([groupKey]);
  return run.branches.filter((branch) => {
    const key = keyOfBranch({ branch, mounts });
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
