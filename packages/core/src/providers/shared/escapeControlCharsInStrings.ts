type EscapeParams = {
  readonly value: string;
};

const ESCAPES: Readonly<Record<string, string>> = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

export const escapeControlCharsInStrings = ({ value }: EscapeParams): string => {
  let result = '';
  let inString = false;
  let escaped = false;
  for (const char of value) {
    const replacement = ESCAPES[char];
    if (inString && !escaped && replacement !== undefined) {
      result += replacement;
      continue;
    }
    result += char;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
    }
  }
  return result;
};
