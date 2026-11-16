const COUNT_CAP = 9;

type Params = {
  readonly count: number;
};

export const countTextOf = ({ count }: Params): string =>
  count > COUNT_CAP ? `${COUNT_CAP}+` : String(count);
