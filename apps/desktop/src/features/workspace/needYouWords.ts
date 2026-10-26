type Params = {
  readonly count: number;
};

export const needYouWords = ({ count }: Params): string =>
  count === 1 ? '1 needs you' : `${count} need you`;
