type Params = {
  readonly paths: ReadonlyArray<string>;
};

export const commonParentDirectory = ({ paths }: Params): string => {
  if (paths.length === 0) {
    return '';
  }

  const splitPaths = paths.map((path) => path.split('/'));
  const firstPath = splitPaths[0];
  if (firstPath == null) {
    return '';
  }

  const sharedSegments: Array<string> = [];
  for (let index = 0; index < firstPath.length; index += 1) {
    const segment = firstPath[index];
    if (segment == null || !splitPaths.every((path) => path[index] === segment)) {
      break;
    }
    sharedSegments.push(segment);
  }

  return sharedSegments.join('/');
};
