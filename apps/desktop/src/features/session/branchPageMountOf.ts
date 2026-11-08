import type { MountId, SessionProjectMount } from '@goodboy/types';

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly mountId: MountId;
};

export const branchPageMountOf = ({ mounts, mountId }: Params): SessionProjectMount | null =>
  mounts.find((candidate) => candidate.mountId === mountId) ?? null;
