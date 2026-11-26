type Params = {
  readonly keys: ReadonlyArray<string>;
  readonly used: ReadonlyArray<string>;
  readonly busy: ReadonlyArray<string>;
};

type RankedKey = {
  readonly key: string;
  readonly at: number;
  readonly isBusy: boolean;
};

export const dockFoldOrderOf = ({ keys, used, busy }: Params): ReadonlyArray<string> =>
  keys
    .map((key, at): RankedKey => ({ key, at, isBusy: busy.includes(key) }))
    .sort((left, right) => {
      if (left.isBusy !== right.isBusy) {
        return left.isBusy ? 1 : -1;
      }
      const recency = used.indexOf(left.key) - used.indexOf(right.key);
      return recency === 0 ? right.at - left.at : recency;
    })
    .map((ranked) => ranked.key);
