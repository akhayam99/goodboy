import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { branchRowFactsOf } from '../../../../features/branch/branchRowFactsOf';

type Params = {
  readonly rows: ReadonlyArray<MountRowView>;
  readonly finishedRows: ReadonlyArray<MountRowView>;
};

export type BranchRows = {
  readonly live: ReadonlyArray<MountRowView>;
  readonly finished: ReadonlyArray<MountRowView>;
};

type RankParams = {
  readonly row: MountRowView;
};

const rankOf = ({ row }: RankParams): number =>
  branchRowFactsOf({
    branch: row.branch,
    mountName: row.mountName,
    request: row.request,
    checks: null,
    behind: null,
    conflicts: null,
  }).rank;

const byRank = (left: MountRowView, right: MountRowView): number =>
  rankOf({ row: left }) - rankOf({ row: right });

export const branchRowsOf = ({ rows, finishedRows }: Params): BranchRows => ({
  live: [...rows].sort(byRank),
  finished: [...finishedRows].sort(byRank),
});
