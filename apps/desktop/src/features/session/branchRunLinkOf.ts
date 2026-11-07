import type { MountId } from '@goodboy/types';
import type { MountRowView } from '../../store/slices/project-mounts/mountRowModel';
import { branchGroupKeysOf, branchGroupShownCountOf, branchGroupsOf } from './branchGroupsOf';
import type { SessionRun } from './sessionRunsOf';

export type BranchRunLink = Readonly<{
  groupKey: string;
  count: number;
  label: string;
}>;

type Params = {
  readonly runs: ReadonlyArray<SessionRun>;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly mountId: MountId;
};

export const branchRunLinkOf = ({ runs, mounts, mountId }: Params): BranchRunLink | null => {
  const first = runs.find((run) => run.branches.some((branch) => branch.mountId === mountId));
  if (first === undefined) {
    return null;
  }
  const own = first.branches.find((branch) => branch.mountId === mountId);
  const groupKey = branchGroupKeysOf({
    run: { ...first, branches: own === undefined ? [] : [own] },
    mounts,
  })[0];
  if (groupKey === undefined) {
    return null;
  }
  const group = branchGroupsOf({ runs, mounts }).find((candidate) => candidate.key === groupKey);
  const count = group === undefined ? 0 : branchGroupShownCountOf({ group });
  if (count === 0) {
    return null;
  }
  return {
    groupKey,
    count,
    label: `${count} ${count === 1 ? 'run' : 'runs'}`,
  };
};
