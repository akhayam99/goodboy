type Params = {
  readonly left: ReadonlyArray<string>;
  readonly right: ReadonlyArray<string>;
};

export const sameKeys = ({ left, right }: Params): boolean =>
  left.length === right.length && left.every((key, index) => key === right[index]);
