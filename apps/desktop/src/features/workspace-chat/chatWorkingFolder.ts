export type ChatFolder = {
  readonly workingDir: string;
  readonly readRoots: ReadonlyArray<string>;
};

type Params = {
  readonly roots: ReadonlyArray<string>;
};

const MIN_SHARED_SEGMENTS = 3;

const trimTrailingSlash = (path: string): string => path.trim().replace(/\/+$/, '');

const segmentsOf = (path: string): ReadonlyArray<string> =>
  path.split('/').filter((segment) => segment !== '');

const sharedPrefix = (paths: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> => {
  const [first, ...rest] = paths;
  if (first === undefined) {
    return [];
  }
  const shared: string[] = [];
  for (const [index, segment] of first.entries()) {
    if (!rest.every((other) => other[index] === segment)) {
      break;
    }
    shared.push(segment);
  }
  return shared;
};

const isInside = ({ root, folder }: { readonly root: string; readonly folder: string }) =>
  root === folder || root.startsWith(`${folder}/`);

export const chatWorkingFolder = ({ roots }: Params): ChatFolder | null => {
  const cleaned = [...new Set(roots.map(trimTrailingSlash).filter((root) => root !== ''))];
  const [first] = cleaned;
  if (first === undefined) {
    return null;
  }
  const shared = sharedPrefix(cleaned.map(segmentsOf));
  const isAbsolute = cleaned.every((root) => root.startsWith('/'));
  const canShare = cleaned.length > 1 && isAbsolute && shared.length >= MIN_SHARED_SEGMENTS;
  const workingDir = canShare ? `/${shared.join('/')}` : first;
  return {
    workingDir,
    readRoots: cleaned.filter((root) => !isInside({ root, folder: workingDir })),
  };
};
