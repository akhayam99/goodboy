import type { InvokeArgs } from '@tauri-apps/api/core';

type FieldParams = {
  readonly payload: InvokeArgs | undefined;
  readonly key: string;
};

const fieldOf = ({ payload, key }: FieldParams): unknown => {
  if (
    payload === undefined ||
    Array.isArray(payload) ||
    payload instanceof ArrayBuffer ||
    payload instanceof Uint8Array
  ) {
    return undefined;
  }
  return payload[key];
};

export const payloadString = ({ payload, key }: FieldParams): string | null => {
  const value = fieldOf({ payload, key });
  return typeof value === 'string' ? value : null;
};

export const payloadStrings = ({ payload, key }: FieldParams): ReadonlyArray<string> => {
  const value = fieldOf({ payload, key });
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
};
