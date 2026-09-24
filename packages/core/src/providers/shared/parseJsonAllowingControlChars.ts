import { escapeControlCharsInStrings } from './escapeControlCharsInStrings';

type ParseParams = {
  readonly text: string;
};

export type JsonParseResult =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false };

const tryParse = ({ text }: ParseParams): JsonParseResult => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

export const parseJsonAllowingControlChars = ({ text }: ParseParams): JsonParseResult => {
  const direct = tryParse({ text });
  if (direct.ok) {
    return direct;
  }
  return tryParse({ text: escapeControlCharsInStrings({ value: text }) });
};
