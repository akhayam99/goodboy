import type { MountId, SessionProjectMount } from '@goodboy/types';

export type MountChangeSnapshot = ReadonlyMap<MountId, string>;

type TouchedParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly workingDir: string;
  readonly editedPaths: ReadonlyArray<string>;
  readonly before: MountChangeSnapshot;
  readonly after: MountChangeSnapshot;
  readonly isShared: boolean;
};

type PathParams = {
  readonly path: string;
  readonly workingDir: string;
};

const isAbsolutePath = (path: string): boolean =>
  path.startsWith('/') || /^[A-Za-z]:[/]/.test(path);

const normalizePath = ({ path, workingDir }: PathParams): string => {
  const slashed = path.replaceAll('\\', '/');
  const joined = isAbsolutePath(slashed)
    ? slashed
    : `${workingDir.replaceAll('\\', '/')}/${slashed}`;
  const segments: Array<string> = [];
  for (const segment of joined.split('/')) {
    if (segment === '.' || (segment === '' && segments.length > 0)) {
      continue;
    }
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
};

type MountForPathParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly path: string;
};

const mountForPath = ({ mounts, path }: MountForPathParams): SessionProjectMount | null => {
  const containing = mounts
    .map((mount) => ({ mount, root: normalizePath({ path: mount.worktreePath, workingDir: '' }) }))
    .filter(({ root }) => path === root || path.startsWith(`${root}/`))
    .sort((a, b) => b.root.length - a.root.length);
  return containing[0]?.mount ?? null;
};

export const touchedMountIds = ({
  mounts,
  workingDir,
  editedPaths,
  before,
  after,
  isShared,
}: TouchedParams): ReadonlyArray<MountId> => {
  const touched = new Set<MountId>();
  for (const editedPath of editedPaths) {
    const mount = mountForPath({ mounts, path: normalizePath({ path: editedPath, workingDir }) });
    if (mount !== null) {
      touched.add(mount.mountId);
    }
  }
  if (!isShared) {
    for (const [mountId, fingerprint] of before) {
      const next = after.get(mountId);
      if (next !== undefined && next !== fingerprint) {
        touched.add(mountId);
      }
    }
  }
  return mounts.filter((mount) => touched.has(mount.mountId)).map((mount) => mount.mountId);
};
