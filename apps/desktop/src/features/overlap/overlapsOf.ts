import type { LiveMount } from './readLiveMounts';

export type Overlap = Readonly<{
  mount: LiveMount;
  other: LiveMount;
  paths: ReadonlyArray<string>;
}>;

type Params = {
  readonly mounts: ReadonlyArray<LiveMount>;
  readonly mountId: string;
};

export const overlapsOf = ({ mounts, mountId }: Params): ReadonlyArray<Overlap> => {
  const mount = mounts.find((candidate) => candidate.mountId === mountId);
  if (mount === undefined || mount.projectId === null || mount.paths.length === 0) {
    return [];
  }
  const own = new Set(mount.paths);
  return mounts.flatMap((other) => {
    if (other.mountId === mount.mountId || other.projectId !== mount.projectId) {
      return [];
    }
    const paths = other.paths.filter((path) => own.has(path));
    return paths.length === 0 ? [] : [{ mount, other, paths }];
  });
};
