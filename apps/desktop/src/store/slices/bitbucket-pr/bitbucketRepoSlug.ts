type Params = {
  readonly projectPath: string | null;
};

export const bitbucketRepoSlug = ({ projectPath }: Params): string | null => {
  if (projectPath == null || projectPath === '') {
    return null;
  }
  const segments = projectPath.split('/').filter((segment) => segment !== '');
  const last = segments.at(-1);
  if (last == null || last === '') {
    return null;
  }
  return last;
};
