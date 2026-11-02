type Params = {
  readonly value: unknown;
};

export const isNullableString = ({ value }: Params): boolean =>
  value === null || typeof value === 'string';
