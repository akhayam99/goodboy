type Params = {
  readonly changeCount: number;
};

export const exploreMetaOf = ({ changeCount }: Params): string | null =>
  changeCount === 0 ? null : `${changeCount} changed`;
