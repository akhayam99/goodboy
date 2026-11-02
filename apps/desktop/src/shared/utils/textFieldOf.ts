type Params = {
  readonly source: Readonly<Record<string, unknown>>;
  readonly key: string;
};

export const textFieldOf = ({ source, key }: Params): string | null => {
  const value = source[key];
  return typeof value === 'string' && value !== '' ? value : null;
};
