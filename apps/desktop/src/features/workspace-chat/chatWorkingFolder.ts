export type ChatFolder = {
  readonly workingDir: string;
  readonly readRoots: ReadonlyArray<string>;
};

type Params = {
  readonly roots: ReadonlyArray<string>;
};

const MIN_SHARED_SEGMENTS = 3;

type PathParams = {
  readonly path: string;
};

const trimTrailingSlash = ({ path }: PathParams): string => path.trim().replace(/\/+$/, '');

const segmentsOf = ({ path }: PathParams): ReadonlyArray<string> =>
  path.split('/').filter((segment) => segment !== '');

type SharedPrefixParams = {
  readonly paths: ReadonlyArray<ReadonlyArray<string>>;
};

const sharedPrefix = ({ paths }: SharedPrefixParams): ReadonlyArray<string> => {
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

type InsideParams = {
  readonly root: string;
  readonly folder: string;
};

const isInside = ({ root, folder }: InsideParams): boolean =>
  root === folder || root.startsWith(`${folder}/`);

export const chatWorkingFolder = ({ roots }: Params): ChatFolder | null => {
  const cleaned = [
    ...new Set(roots.map((path) => trimTrailingSlash({ path })).filter((root) => root !== '')),
  ];
  const [first] = cleaned;
  if (first === undefined) {
    return null;
  }
  const shared = sharedPrefix({ paths: cleaned.map((path) => segmentsOf({ path })) });
  const isAbsolute = cleaned.every((root) => root.startsWith('/'));
  const canShare = cleaned.length > 1 && isAbsolute && shared.length >= MIN_SHARED_SEGMENTS;
  const workingDir = canShare ? `/${shared.join('/')}` : first;
  return {
    workingDir,
    readRoots: cleaned.filter((root) => !isInside({ root, folder: workingDir })),
  };
};
