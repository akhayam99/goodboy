type Params = {
  readonly root: string;
  readonly baseDir: string;
  readonly path: string;
};

type SegmentsParams = {
  readonly value: string;
};

type NormalizeParams = {
  readonly segments: ReadonlyArray<string>;
};

const pathPartsOf = ({ value }: SegmentsParams): ReadonlyArray<string> =>
  value.split('/').filter((segment) => segment !== '' && segment !== '.');

const normalized = ({ segments }: NormalizeParams): ReadonlyArray<string> | null => {
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment !== '..') {
      stack.push(segment);
      continue;
    }
    if (stack.length === 0) {
      return null;
    }
    stack.pop();
  }
  return stack;
};

export const fileLinkRelPath = ({ root, baseDir, path }: Params): string | null => {
  const rootSegments = normalized({ segments: pathPartsOf({ value: root }) });
  const start = path.startsWith('/') ? path : `${baseDir}/${path}`;
  const target = normalized({ segments: pathPartsOf({ value: start }) });
  if (rootSegments === null || target === null || rootSegments.length === 0) {
    return null;
  }
  const isUnderRoot = rootSegments.every((segment, index) => target[index] === segment);
  if (!isUnderRoot || target.length <= rootSegments.length) {
    return null;
  }
  return target.slice(rootSegments.length).join('/');
};
