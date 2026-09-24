type ParseJsonColumnParams<T> = {
  readonly value: string | null;
  readonly isValid: (value: unknown) => value is T;
  readonly fallback: T;
};

export const parseJsonColumn = <T>({ value, isValid, fallback }: ParseJsonColumnParams<T>): T => {
  if (value === null) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const isJsonValue = (value: unknown): value is unknown => value !== undefined;

export const isJsonRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isJsonArray = (value: unknown): value is ReadonlyArray<unknown> =>
  Array.isArray(value);

export const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');
