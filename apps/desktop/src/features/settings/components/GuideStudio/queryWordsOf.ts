type Params = {
  readonly query: string;
};

export const queryWordsOf = ({ query }: Params): ReadonlyArray<string> =>
  query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '');
