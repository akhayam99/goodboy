type Params = {
  readonly count: number;
};

export const repliesLabel = ({ count }: Params): string =>
  count === 1 ? '1 reply' : `${count} replies`;
