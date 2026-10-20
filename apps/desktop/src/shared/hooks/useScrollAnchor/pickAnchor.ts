type IndexParams = {
  readonly index: number;
};

type Params = {
  readonly count: number;
  readonly bottomOf: (params: IndexParams) => number;
  readonly edge: number;
};

export const pickAnchor = ({ count, bottomOf, edge }: Params): number | null => {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (bottomOf({ index: middle }) > edge) {
      high = middle;
      continue;
    }
    low = middle + 1;
  }
  return low < count ? low : null;
};
