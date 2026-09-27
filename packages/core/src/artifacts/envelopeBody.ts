export type EnvelopeBody = {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly rawContent: string | null;
};

type LeadingObject = {
  readonly json: string;
  readonly end: number;
};

const OPEN_SMART_QUOTE = '“';
const CLOSE_SMART_QUOTE = '”';
const VALID_ESCAPES: ReadonlySet<string> = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const HEX_RE = /^[0-9a-fA-F]{4}$/;
const LITERAL_RE = /^(?:true|false|null)(?![A-Za-z0-9_])/;
const NUMBER_START_RE = /[-0-9]/;
const WHITESPACE_RE = /\s/;
const CONTROL_ESCAPES: Readonly<Record<string, string>> = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseRecord = (text: string): Readonly<Record<string, unknown>> | null => {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isSmartQuote = (char: string | undefined): boolean =>
  char === OPEN_SMART_QUOTE || char === CLOSE_SMART_QUOTE;

const skipWhitespace = (text: string, from: number): number => {
  let index = from;
  while (index < text.length && WHITESPACE_RE.test(text[index]!)) {
    index += 1;
  }
  return index;
};

const startsValue = (text: string, at: number): boolean => {
  const char = text[at];
  if (char === undefined) {
    return false;
  }
  if (char === '"' || char === '{' || char === '[' || isSmartQuote(char)) {
    return true;
  }
  if (NUMBER_START_RE.test(char)) {
    return true;
  }
  return LITERAL_RE.test(text.slice(at, at + 6));
};

const closesString = (text: string, after: number): boolean => {
  const next = skipWhitespace(text, after);
  const char = text[next];
  if (char === undefined || char === '}' || char === ']' || char === ':') {
    return true;
  }
  if (char !== ',') {
    return false;
  }
  return startsValue(text, skipWhitespace(text, next + 1));
};

const controlEscape = (char: string): string | null => {
  const named = CONTROL_ESCAPES[char];
  if (named !== undefined) {
    return named;
  }
  const code = char.charCodeAt(0);
  return code < 0x20 ? `\\u${code.toString(16).padStart(4, '0')}` : null;
};

const readLeadingObject = (text: string): LeadingObject | null => {
  const start = text.indexOf('{');
  if (start === -1 || text.slice(0, start).trim().length > 0) {
    return null;
  }
  let out = '';
  let depth = 0;
  let quote: '"' | 'smart' | null = null;
  let index = start;
  while (index < text.length) {
    const char = text[index]!;
    if (quote !== null) {
      if (char === '\\') {
        const next = text[index + 1];
        if (next === 'u' && HEX_RE.test(text.slice(index + 2, index + 6))) {
          out += text.slice(index, index + 6);
          index += 6;
          continue;
        }
        if (next !== undefined && next !== 'u' && VALID_ESCAPES.has(next)) {
          out += `\\${next}`;
          index += 2;
          continue;
        }
        out += '\\\\';
        index += 1;
        continue;
      }
      const isCloser = quote === '"' ? char === '"' : isSmartQuote(char);
      if (isCloser && closesString(text, index + 1)) {
        out += '"';
        quote = null;
        index += 1;
        continue;
      }
      if (char === '"') {
        out += '\\"';
        index += 1;
        continue;
      }
      out += controlEscape(char) ?? char;
      index += 1;
      continue;
    }
    if (char === '"' || isSmartQuote(char)) {
      quote = char === '"' ? '"' : 'smart';
      out += '"';
      index += 1;
      continue;
    }
    out += char;
    index += 1;
    if (char === '{' || char === '[') {
      depth += 1;
      continue;
    }
    if (char !== '}' && char !== ']') {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return { json: out, end: index };
    }
  }
  return null;
};

const stripLeadingLineBreak = (text: string): string => {
  const lineEnd = text.indexOf('\n');
  if (lineEnd === -1) {
    return text;
  }
  return text.slice(0, lineEnd).trim().length === 0 ? text.slice(lineEnd + 1) : text;
};

type ParsedLeading = {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly end: number;
  readonly strict: boolean;
};

const parseLeading = (text: string): ParsedLeading | null => {
  const leading = readLeadingObject(text);
  if (leading === null) {
    return null;
  }
  const strict = parseRecord(text.slice(0, leading.end));
  if (strict !== null) {
    return { fields: strict, end: leading.end, strict: true };
  }
  const repaired = parseRecord(leading.json);
  return repaired === null ? null : { fields: repaired, end: leading.end, strict: false };
};

const JSON_ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

const decodeLooseString = (raw: string): string => {
  let out = '';
  let index = 0;
  while (index < raw.length) {
    const char = raw[index]!;
    if (char !== '\\') {
      out += char;
      index += 1;
      continue;
    }
    const next = raw[index + 1] ?? '';
    const hex = raw.slice(index + 2, index + 6);
    if (next === 'u' && HEX_RE.test(hex)) {
      out += String.fromCharCode(Number.parseInt(hex, 16));
      index += 6;
      continue;
    }
    const decoded = JSON_ESCAPES[next];
    if (decoded === undefined) {
      out += char;
      index += 1;
      continue;
    }
    out += decoded;
    index += 2;
  }
  return out;
};

const CONTENT_KEY_RE = /["“”]content["“”][ \t]*:[ \t]*["“”]/;
const MAX_CLOSING_CANDIDATES = 24;

const isQuote = (char: string | undefined): boolean => char === '"' || isSmartQuote(char);

const closingCandidates = (text: string, from: number): ReadonlyArray<number> => {
  const found: number[] = [];
  for (let index = text.length - 1; index >= from; index -= 1) {
    if (!isQuote(text[index])) {
      continue;
    }
    const next = text[skipWhitespace(text, index + 1)];
    if (next === ',' || next === '}') {
      found.push(index);
    }
    if (found.length >= MAX_CLOSING_CANDIDATES) {
      break;
    }
  }
  return found;
};

const recoverContentSlot = (text: string): EnvelopeBody | null => {
  const match = CONTENT_KEY_RE.exec(text);
  if (match === null) {
    return null;
  }
  const contentStart = match.index + match[0].length;
  const head = text.slice(0, contentStart - 1);
  let best: { readonly fields: EnvelopeBody['fields']; readonly end: number } | null = null;
  for (const close of closingCandidates(text, contentStart)) {
    const tail = text.slice(close + 1);
    const parsed = parseLeading(`${head}""${tail}`);
    if (parsed === null || parsed.fields['content'] !== '') {
      continue;
    }
    const end = close + 1 + (parsed.end - head.length - 2);
    if (best !== null && best.end >= end) {
      continue;
    }
    const content = decodeLooseString(text.slice(contentStart, close));
    best = { fields: { ...parsed.fields, content }, end };
  }
  return best === null ? null : { fields: best.fields, rawContent: null };
};

export const readEnvelopeBody = (body: string): EnvelopeBody | null => {
  const trimmed = body.trim();
  const strict = parseRecord(trimmed);
  if (strict !== null) {
    return { fields: strict, rawContent: null };
  }
  const leading = parseLeading(trimmed);
  const rest = leading === null ? '' : trimmed.slice(leading.end);
  const isHeader =
    leading !== null &&
    leading.fields['content'] === undefined &&
    rest.trim().length > 0 &&
    (leading.strict || !CONTENT_KEY_RE.test(rest));
  if (isHeader) {
    return { fields: leading.fields, rawContent: stripLeadingLineBreak(rest) };
  }
  if (leading !== null && leading.strict) {
    return { fields: leading.fields, rawContent: null };
  }
  const recovered = recoverContentSlot(trimmed);
  if (recovered !== null) {
    return recovered;
  }
  return leading === null ? null : { fields: leading.fields, rawContent: null };
};
