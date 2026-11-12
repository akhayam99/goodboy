import type { MountId } from '@goodboy/types';
import type { BranchGroupHead } from './branchGroupsOf';

type Params = {
  readonly head: BranchGroupHead;
};

export const branchHeadMountIdsOf = ({ head }: Params): ReadonlyArray<MountId> => {
  if (head.kind === 'branch') {
    return [head.branch.mountId];
  }
  if (head.kind === 'series') {
    return head.parts.map((part) => part.mountId);
  }
  return [];
};
