import type { MountId, SessionProjectMount } from '@goodboy/types';

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly mountId: MountId | null | undefined;
};

export const findMountById = ({ mounts, mountId }: Params): SessionProjectMount | null => {
  if (mountId == null) {
    return null;
  }
  return mounts.find((candidate) => candidate.mountId === mountId) ?? null;
};
