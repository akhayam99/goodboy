type Params = {
  readonly at: number | null;
};

export const isoOrNull = ({ at }: Params): string | null =>
  at === null || Number.isNaN(at) ? null : new Date(at).toISOString();
