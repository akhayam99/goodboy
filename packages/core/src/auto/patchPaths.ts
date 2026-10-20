const HEADER = 'diff --git ';
const RENAME_FROM = 'rename from ';
const QUOTE = '"';

type RestParams = {
  readonly rest: string;
};

const unquoted = ({ rest }: RestParams): string => {
  if (!rest.startsWith(QUOTE) || !rest.endsWith(QUOTE)) {
    return rest;
  }
  return rest.slice(1, -1).split('\\"').join('"').split('\\\\').join('\\');
};

const newPathOf = ({ rest }: RestParams): string | null => {
  const half = (rest.length - 1) / 2;
  if (Number.isInteger(half) && half > 0) {
    const left = rest.slice(0, half);
    const right = rest.slice(half + 1);
    if (rest[half] === ' ' && left.startsWith('a/') && right === `b/${left.slice(2)}`) {
      return left.slice(2);
    }
  }
  const quoted = rest.lastIndexOf(' "b/');
  if (quoted >= 0) {
    return unquoted({ rest: rest.slice(quoted + 1) }).slice(2);
  }
  const split = rest.lastIndexOf(' b/');
  return split >= 0 ? rest.slice(split + 3) : null;
};

export type PathsOfPatchParams = Readonly<{
  patch: string;
}>;

export const pathsOfPatch = ({ patch }: PathsOfPatchParams): ReadonlyArray<string> => {
  const paths = new Set<string>();
  for (const line of patch.split('\n')) {
    if (line.startsWith(HEADER)) {
      const path = newPathOf({ rest: line.slice(HEADER.length) });
      if (path !== null && path !== '') {
        paths.add(path);
      }
      continue;
    }
    if (line.startsWith(RENAME_FROM)) {
      paths.add(unquoted({ rest: line.slice(RENAME_FROM.length) }));
    }
  }
  return [...paths].sort();
};
