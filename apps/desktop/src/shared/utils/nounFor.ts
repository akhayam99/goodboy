type Params = {
  readonly count: number;
  readonly one: string;
  readonly many?: string;
};

export const nounFor = ({ count, one, many = `${one}s` }: Params): string =>
  count === 1 ? one : many;
