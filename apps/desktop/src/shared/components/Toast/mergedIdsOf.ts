type Params = {
  readonly a: ReadonlyArray<string> | undefined;
  readonly b: ReadonlyArray<string> | undefined;
};

export const mergedIdsOf = ({ a, b }: Params): ReadonlyArray<string> | undefined => {
  if (a === undefined && b === undefined) {
    return undefined;
  }
  return [...new Set([...(a ?? []), ...(b ?? [])])];
};
