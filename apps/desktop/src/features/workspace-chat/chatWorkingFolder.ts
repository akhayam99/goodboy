export type ChatFolder = {
  readonly workingDir: string;
  readonly readRoots: ReadonlyArray<string>;
};

type Params = {
  readonly roots: ReadonlyArray<string>;
};

type PathParams = {
  readonly path: string;
};

const trimTrailingSlash = ({ path }: PathParams): string => {
  const trimmed = path.trim();
  const withoutSlash = trimmed.replace(/\/+$/, '');
  return withoutSlash === '' ? trimmed : withoutSlash;
};

const isUsable = ({ path }: PathParams): boolean => path.startsWith('/') && path !== '/';

type InsideParams = {
  readonly root: string;
  readonly folder: string;
};

const isInside = ({ root, folder }: InsideParams): boolean =>
  root === folder || root.startsWith(`${folder}/`);

export const chatWorkingFolder = ({ roots }: Params): ChatFolder | null => {
  const cleaned = [
    ...new Set(
      roots.map((path) => trimTrailingSlash({ path })).filter((path) => isUsable({ path })),
    ),
  ];
  const [workingDir] = cleaned;
  if (workingDir === undefined) {
    return null;
  }
  return {
    workingDir,
    readRoots: cleaned.filter((root) => !isInside({ root, folder: workingDir })),
  };
};
