type Params = {
  readonly commitSha: string | null;
};

export const resolverDiffActionLabel = ({ commitSha }: Params): string =>
  commitSha === null
    ? 'Open the diff of the uncommitted changes'
    : `Open the diff of commit ${commitSha.slice(0, 7)}`;
