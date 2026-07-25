const MAX_CHARS = 400;

type Params = {
  readonly input: unknown;
};

export const formatRequestInput = ({ input }: Params): string | null => {
  if (input == null) {
    return null;
  }
  const json = JSON.stringify(input, null, 2);
  if (json === undefined || json === '{}') {
    return null;
  }
  return json.length > MAX_CHARS ? `${json.slice(0, MAX_CHARS)}...` : json;
};
