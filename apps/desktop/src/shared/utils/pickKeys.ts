type Params<T> = {
  readonly source: Readonly<Record<string, T>> | undefined;
  readonly keys: ReadonlyArray<string>;
};

export const pickKeys = <T>({ source, keys }: Params<T>): Readonly<Record<string, T>> => {
  const picked: Record<string, T> = {};
  if (source === undefined) {
    return picked;
  }
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) {
      picked[key] = value;
    }
  }
  return picked;
};
