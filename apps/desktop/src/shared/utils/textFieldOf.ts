type Params = {
  readonly source: Readonly<Record<string, unknown>>;
  readonly key: string;
};

export const textFieldOf = ({ source, key }: Params): string | null => {
  const field = source[key];
  return typeof field === 'string' && field !== '' ? field : null;
};
