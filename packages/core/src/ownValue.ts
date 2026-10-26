type Params<T> = {
  readonly table: Readonly<Record<string, T>>;
  readonly key: string;
};

export const ownValue = <T>({ table, key }: Params<T>): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;
