type Params = {
  readonly path: string | null;
};

export const retainedDirName = ({ path }: Params): string | undefined => {
  if (path === null) {
    return undefined;
  }
  const name = path
    .split(/[\\/]/)
    .filter((part) => part !== '')
    .pop();
  return name === undefined || name === '' ? undefined : name;
};
