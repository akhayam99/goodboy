type Params = {
  readonly text: string;
};

export const routeWordsOf = ({ text }: Params): ReadonlyArray<string> =>
  text
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .filter((word) => word !== '');
