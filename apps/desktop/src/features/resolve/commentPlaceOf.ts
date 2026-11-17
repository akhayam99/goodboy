type Params = {
  readonly path: string | null;
  readonly line: number | null;
};

export const commentPlaceOf = ({ path, line }: Params): string | null => {
  if (path === null || path === '') {
    return null;
  }
  const name = path.split('/').pop() ?? path;
  return line === null ? name : `${name}:${line}`;
};
