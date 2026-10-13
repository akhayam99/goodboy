import type { MountId } from '@goodboy/types';

type MountBranchGone = Readonly<{
  restorableBranchId: string | null;
}>;

export type MountBranchGoneMap = Readonly<Record<string, MountBranchGone>>;

type WithoutParams = {
  readonly gone: MountBranchGoneMap;
  readonly mountId: MountId;
};

export const withoutMountBranchGone = ({ gone, mountId }: WithoutParams): MountBranchGoneMap => {
  if (gone[mountId] === undefined) {
    return gone;
  }
  return Object.fromEntries(Object.entries(gone).filter(([id]) => id !== mountId));
};
