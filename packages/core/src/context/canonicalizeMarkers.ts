const MARKER_NAMES = [
  'step-done',
  'handoff',
  'ctx-question',
  'ctx-decision',
  'ctx-resolved',
  'plan',
  'fan-out',
  'scout-split',
  'clusters',
  'cluster-done',
  'oq-answer',
] as const;

const NAMES_ALT = MARKER_NAMES.join('|');
const NEEDS_WORK_RE = new RegExp(
  String.raw`\\[<>]|&(?:lt|gt|quot|apos|#39);|<<\s|<<\/?[A-Z]|=\s*[“”]|<<\/?(?:${NAMES_ALT})[^<>\n]*>(?!>)`,
);
const OPEN_RE = new RegExp(String.raw`(?:\\?<|&lt;){2}[ \t]*(\/?)(${NAMES_ALT})(?![\w-])`, 'gi');
const SINGLE_CLOSE_NAMES: ReadonlySet<string> = new Set(['step-done', 'handoff']);
const MAX_TAG_CHARS = 600;
const QUOTE_RE = /^(?:\\?"|&quot;|[“”])/;
const CLOSE_RE = /^(?:\\?>|&gt;)/;

type ScanParams = {
  readonly text: string;
  readonly from: number;
};

type Scanned = {
  readonly inner: string;
  readonly end: number;
  readonly isSingleClose: boolean;
};

const scanInner = ({ text, from }: ScanParams): Scanned | null => {
  let isQuoted = false;
  const limit = Math.min(text.length, from + MAX_TAG_CHARS);
  for (let i = from; i < limit; i += 1) {
    const rest = text.slice(i, i + 8);
    if (rest.startsWith('\n')) {
      return null;
    }
    const quote = QUOTE_RE.exec(rest);
    if (quote !== null) {
      isQuoted = !isQuoted;
      i += quote[0].length - 1;
      continue;
    }
    if (isQuoted) {
      continue;
    }
    const first = CLOSE_RE.exec(rest);
    if (first === null) {
      if (rest.startsWith('<')) {
        return null;
      }
      continue;
    }
    const second = CLOSE_RE.exec(text.slice(i + first[0].length, i + first[0].length + 8));
    const end = i + first[0].length + (second === null ? 0 : second[0].length);
    return { inner: text.slice(from, i), end, isSingleClose: second === null };
  }
  return null;
};

type InnerParams = {
  readonly inner: string;
};

const cleanInner = ({ inner }: InnerParams): string => {
  const unescaped = inner
    .replace(/\\(["'<>])/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return unescaped.replace(/=\s*[“”]([^“”"]*)[“”]/g, '="$1"');
};

type CanonicalParams = {
  readonly text: string;
};

export const canonicalizeMarkers = ({ text }: CanonicalParams): string => {
  if (!text.includes('<') && !text.includes('&')) {
    return text;
  }
  if (!NEEDS_WORK_RE.test(text)) {
    return text;
  }
  OPEN_RE.lastIndex = 0;
  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = OPEN_RE.exec(text)) !== null) {
    const from = match.index + match[0].length;
    const scanned = scanInner({ text, from });
    if (scanned === null) {
      continue;
    }
    const slash = match[1] ?? '';
    const name = (match[2] ?? '').toLowerCase();
    if (scanned.isSingleClose && (slash !== '' || !SINGLE_CLOSE_NAMES.has(name))) {
      continue;
    }
    out += `${text.slice(cursor, match.index)}<<${slash}${name}${cleanInner({ inner: scanned.inner })}>>`;
    cursor = scanned.end;
    OPEN_RE.lastIndex = scanned.end;
  }
  return out + text.slice(cursor);
};
