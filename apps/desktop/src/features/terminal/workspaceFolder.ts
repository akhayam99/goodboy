import { trimTrailingSeparators } from '../../store/slices/terminal/terminalOwner';

export type FolderRoot = {
  readonly path: string;
  readonly isStarred: boolean;
};

type FolderParams = {
  readonly roots: ReadonlyArray<FolderRoot>;
  readonly home: string | null;
  readonly override: string | null;
};

type SegmentParams = {
  readonly path: string;
};

type CommonParams = {
  readonly paths: ReadonlyArray<string>;
};

type BelowParams = {
  readonly folder: string;
  readonly home: string | null;
};

const segmentsOf = ({ path }: SegmentParams): ReadonlyArray<string> =>
  trimTrailingSeparators({ path })
    .split('/')
    .filter((segment) => segment !== '');

const commonParent = ({ paths }: CommonParams): string | null => {
  const [first, ...rest] = paths.map((path) => segmentsOf({ path }).slice(0, -1));
  if (first === undefined) {
    return null;
  }
  let length = first.length;
  for (const other of rest) {
    let shared = 0;
    while (shared < length && shared < other.length && first[shared] === other[shared]) {
      shared += 1;
    }
    length = shared;
  }
  return length === 0 ? null : `/${first.slice(0, length).join('/')}`;
};

const isBelowHome = ({ folder, home }: BelowParams): boolean => {
  if (home === null) {
    return true;
  }
  const normalizedHome = trimTrailingSeparators({ path: home });
  return folder !== normalizedHome && folder.startsWith(`${normalizedHome}/`);
};

export const workspaceFolder = ({ roots, home, override }: FolderParams): string | null => {
  if (override !== null && override.trim() !== '') {
    return override;
  }
  const parent = commonParent({ paths: roots.map((root) => root.path) });
  if (parent !== null && isBelowHome({ folder: parent, home })) {
    return parent;
  }
  const starred = roots.find((root) => root.isStarred);
  return (starred ?? roots[0])?.path ?? null;
};
