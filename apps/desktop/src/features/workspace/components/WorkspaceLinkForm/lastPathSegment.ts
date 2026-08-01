type Params = {
  readonly path: string;
};

export const lastPathSegment = ({ path }: Params): string =>
  path.split('/').filter(Boolean).at(-1) ?? path;
