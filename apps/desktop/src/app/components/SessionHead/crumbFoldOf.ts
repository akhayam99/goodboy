type Params = {
  readonly count: number;
};

export type CrumbFold = Readonly<{
  shown: ReadonlyArray<number>;
  folded: ReadonlyArray<number>;
}>;

const FOLD_FROM = 5;
const KEPT_TAIL = 2;

export const crumbFoldOf = ({ count }: Params): CrumbFold => {
  const all = Array.from({ length: count }, (_, index) => index);
  if (count < FOLD_FROM) {
    return { shown: all, folded: [] };
  }
  const tailStart = count - KEPT_TAIL;
  return {
    shown: [0, ...all.slice(tailStart)],
    folded: all.slice(1, tailStart),
  };
};
