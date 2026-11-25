type Params = {
  readonly value: unknown;
};

export const asString = ({ value }: Params): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;
