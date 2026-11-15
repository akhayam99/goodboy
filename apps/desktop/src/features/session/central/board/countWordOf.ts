type Params = {
  readonly count: number;
  readonly noun: string;
};

export const countWordOf = ({ count, noun }: Params): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;
