type Params = {
  readonly input: unknown;
};

export const toolCommandOf = ({ input }: Params): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const value: unknown = Reflect.get(input, 'command');
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};
