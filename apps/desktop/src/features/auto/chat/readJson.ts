export type JsonRecord = Readonly<Record<string, unknown>>;

export const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type FieldParams = {
  readonly source: unknown;
  readonly key: string;
};

export const textField = ({ source, key }: FieldParams): string | null => {
  if (!isJsonRecord(source)) {
    return null;
  }
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

export const numberField = ({ source, key }: FieldParams): number | null => {
  if (!isJsonRecord(source)) {
    return null;
  }
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const recordField = ({ source, key }: FieldParams): JsonRecord | null => {
  if (!isJsonRecord(source)) {
    return null;
  }
  const value = source[key];
  return isJsonRecord(value) ? value : null;
};

export const listField = ({ source, key }: FieldParams): ReadonlyArray<unknown> => {
  if (!isJsonRecord(source)) {
    return [];
  }
  const value = source[key];
  return Array.isArray(value) ? value : [];
};
