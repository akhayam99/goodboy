type Params<Value> = {
  readonly ids: ReadonlyArray<string>;
  readonly record: Readonly<Record<string, Value>> | undefined;
};

export const pickForSessions = <Value>({
  ids,
  record,
}: Params<Value>): Readonly<Record<string, Value>> =>
  Object.fromEntries(
    ids.flatMap((id) => {
      const value = record?.[id];
      return value === undefined ? [] : [[id, value]];
    }),
  );
