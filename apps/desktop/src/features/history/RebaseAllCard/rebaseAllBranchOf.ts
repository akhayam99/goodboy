import type { MountId } from '@goodboy/types';
import type { RebaseAllBranch, RebaseAllRun } from '../../../store/slices/rebaseAll/types';

type Params = {
  readonly run: RebaseAllRun | null;
  readonly mountId: MountId;
};

export const rebaseAllBranchOf = ({ run, mountId }: Params): RebaseAllBranch | null =>
  run?.branches.find((branch) => branch.mountId === mountId) ?? null;
