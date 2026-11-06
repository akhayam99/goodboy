import type { SessionProjectMount } from '@goodboy/types';

type ResolveDiffMountParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly requestedPath: string | null;
  readonly fallbackPath: string | null;
};

export const resolveDiffMount = ({
  mounts,
  requestedPath,
  fallbackPath,
}: ResolveDiffMountParams): string | null => {
  if (requestedPath == null || requestedPath === '') {
    return fallbackPath;
  }
  const isStillMounted = mounts.some((mount) => mount.worktreePath === requestedPath);
  return isStillMounted ? requestedPath : fallbackPath;
};
