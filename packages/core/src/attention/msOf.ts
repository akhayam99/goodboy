type Params = {
  readonly value: string | null | undefined;
};

export const msOf = ({ value }: Params): number | null => {
  const at = Date.parse(value ?? '');
  return Number.isFinite(at) ? at : null;
};
