type Params = {
  readonly value: unknown;
  readonly max: number;
};

export const clippedTextOf = ({ value, max }: Params): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
};
