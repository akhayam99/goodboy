import type { MountId } from '@goodboy/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import type { GroupBy } from '../../../../store/slices/session-grouping/state';
import type { ArtifactBranchView, ArtifactListRow } from '../../artifactListRows';

type GroupByParams = {
  readonly groupBy: GroupBy;
};

type OpenBranchParams = {
  readonly mountId: MountId;
};

export type ArtifactBranchProps = Readonly<{
  view: ArtifactBranchView;
  mounts: ReadonlyArray<MountRowView>;
  groupBy: GroupBy;
  branchCount: number;
  onGroupByChange: (params: GroupByParams) => void;
  onOpenBranch: (params: OpenBranchParams) => void;
}>;

export type ArtifactOpenParams = Readonly<{
  row: ArtifactListRow;
  rowKey: string;
}>;
