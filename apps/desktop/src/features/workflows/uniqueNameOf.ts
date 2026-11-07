type Params = {
  readonly requested: string;
  readonly taken: ReadonlyArray<string>;
};

export const uniqueNameOf = ({ requested, taken }: Params): string => {
  const names = new Set(taken);
  if (!names.has(requested)) {
    return requested;
  }
  let suffix = 2;
  while (names.has(`${requested} ${suffix}`)) {
    suffix += 1;
  }
  return `${requested} ${suffix}`;
};
