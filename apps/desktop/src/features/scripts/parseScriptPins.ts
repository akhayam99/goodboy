type Params = {
  readonly raw: string | undefined;
};

export const parseScriptPins = ({ raw }: Params): ReadonlyArray<string> => {
  if (raw === undefined || raw === '') {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
};
