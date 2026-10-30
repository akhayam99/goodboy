type Params = {
  readonly count: number;
};

export const helpersWordOf = ({ count }: Params): string =>
  count === 1 ? '1 helper' : `${count} helpers`;
