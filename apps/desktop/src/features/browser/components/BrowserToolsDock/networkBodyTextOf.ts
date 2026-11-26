type Params = {
  readonly body: string;
};

const JSON_START = new Set(['{', '[']);

export const networkBodyTextOf = ({ body }: Params): string => {
  const trimmed = body.trim();
  if (!JSON_START.has(trimmed.charAt(0))) {
    return body;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
};
