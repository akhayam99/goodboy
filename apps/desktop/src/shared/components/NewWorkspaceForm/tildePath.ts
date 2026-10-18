type Params = {
  readonly path: string;
  readonly home: string | null;
};

export const tildePath = ({ path, home }: Params): string => {
  if (home === null || home === '') {
    return path;
  }
  if (path === home) {
    return '~';
  }
  if (path.startsWith(`${home}/`)) {
    return `~${path.slice(home.length)}`;
  }
  return path;
};
