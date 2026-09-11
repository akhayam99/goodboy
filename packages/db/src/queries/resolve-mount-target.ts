import type { MountId, MountTargetSnapshot } from '@goodboy/types';

export type MountTargetColumns = Readonly<{
  mountId: string | null;
  mountRevision: number | null;
  worktreePath: string | null;
}>;

export const toMountTarget = ({
  mountId,
  mountRevision,
  worktreePath,
}: MountTargetColumns): MountTargetSnapshot | null => {
  if (mountId === null || mountRevision === null || worktreePath === null) {
    return null;
  }
  return { mountId: mountId as MountId, mountRevision, worktreePath };
};

export const fromMountTarget = ({
  target,
}: {
  readonly target: MountTargetSnapshot | null;
}): MountTargetColumns =>
  target === null
    ? { mountId: null, mountRevision: null, worktreePath: null }
    : {
        mountId: target.mountId,
        mountRevision: target.mountRevision,
        worktreePath: target.worktreePath,
      };
