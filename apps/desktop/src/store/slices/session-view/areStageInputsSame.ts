type Inputs = Readonly<Record<string, unknown>>;

type Params = {
  readonly first: Inputs;
  readonly second: Inputs;
};

export const areStageInputsSame = ({ first, second }: Params): boolean => {
  const entries = Object.entries(first);
  return (
    entries.length === Object.keys(second).length &&
    entries.every(([key, value]) => Object.is(value, Reflect.get(second, key)))
  );
};
