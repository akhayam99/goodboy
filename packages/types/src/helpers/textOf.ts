type Params = {
  readonly value: unknown;
};

export const textOf = ({ value }: Params): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
