import type { MountId, SessionMountView } from '@goodboy/types';

type Params = {
  readonly mounts: ReadonlyArray<SessionMountView>;
};

export const soleMountIdOf = ({ mounts }: Params): MountId | null => {
  const only = mounts.length === 1 ? mounts[0] : undefined;
  return only === undefined || only.branch === '' ? null : only.id;
};
