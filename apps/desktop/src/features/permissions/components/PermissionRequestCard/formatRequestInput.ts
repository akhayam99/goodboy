type Params = {
  readonly input: unknown;
};

export const formatRequestInput = ({ input }: Params): string | null => {
  if (input == null) {
    return null;
  }
  const json = JSON.stringify(input);
  if (json === undefined || json === '{}') {
    return null;
  }
  return json;
};
