import type { MountId } from '@goodboy/types';
import type { MountRowView } from '../../store/slices/project-mounts/mountRowModel';
import { branchGroupKeyOfMount } from '../session/branchGroupsOf';
import { branchWorkLinkOf, type BranchWorkLink } from '../session/branchWorkLinkOf';
import { artifactBranchCountOf } from './artifactBranchRowKeys';
import type { ArtifactBranchView } from './artifactListRows';

type Params = {
  readonly view: ArtifactBranchView;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly mountId: MountId;
};

export const artifactBranchLinkOf = ({ view, mounts, mountId }: Params): BranchWorkLink | null => {
  const groupKey = branchGroupKeyOfMount({ mountId, mounts });
  const group = view.groups.find((candidate) => candidate.key === groupKey);
  const count =
    group === undefined ? 0 : artifactBranchCountOf({ rows: group.items.map((item) => item.row) });
  return branchWorkLinkOf({ groupKey, count, one: 'artifact', many: 'artifacts' });
};
