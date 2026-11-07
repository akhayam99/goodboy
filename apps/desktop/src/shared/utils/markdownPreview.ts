type Params = {
  readonly text: string | null | undefined;
};

const MAX_LINE = 2000;
const MAX_COMMENT_LOOKAHEAD = 40;
const MAX_NESTING = 3;
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const BLOCK_MARKER = /^(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d{1,9}\.[ \t]+)+/;
const BOLD_RE = /\*\*([^*]+)\*\*|__([^_]+)__/g;
const ITALIC_RE = /(?<![*\w])\*([^*]+)\*(?!\*)|(?<![_\w])_([^_]+)_(?!_)/g;

type LinesParams = {
  readonly lines: ReadonlyArray<string>;
};

type ScanParams = {
  readonly lines: ReadonlyArray<string>;
  readonly index: number;
  readonly depth: number;
};

type ScanResult = {
  readonly text: string;
  readonly next: number;
};

type CloseParams = {
  readonly line: string;
  readonly from: number;
};

type CharParams = {
  readonly char: string | undefined;
};

const isLetter = ({ char }: CharParams): boolean =>
  char !== undefined && ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z'));

type PairParams = CloseParams & {
  readonly open: string;
  readonly close: string;
};

const pairCloseOf = ({ line, from, open, close }: PairParams): number => {
  let depth = 1;
  for (let i = from; i < line.length; i += 1) {
    const char = line[i];
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (char === open) {
      depth += 1;
    }
    if (char === close) {
      depth -= 1;
    }
    if (depth === 0) {
      return i;
    }
  }
  return -1;
};

const balancedCloseOf = ({ line, from }: CloseParams): number =>
  pairCloseOf({ line, from, open: '(', close: ')' });

const bracketCloseOf = ({ line, from }: CloseParams): number =>
  pairCloseOf({ line, from, open: '[', close: ']' });

type LinkParams = {
  readonly line: string;
  readonly at: number;
};

const linkEndsOf = ({ line, at }: LinkParams): { readonly label: number; readonly url: number } => {
  const start = line[at] === '!' ? at + 2 : at + 1;
  const label = bracketCloseOf({ line, from: start });
  if (label < 0 || line[label + 1] !== '(') {
    return { label: -1, url: -1 };
  }
  return { label, url: balancedCloseOf({ line, from: label + 2 }) };
};

type CommentParams = {
  readonly lines: ReadonlyArray<string>;
  readonly from: number;
};

const commentCloseRowOf = ({ lines, from }: CommentParams): number => {
  const limit = Math.min(lines.length, from + MAX_COMMENT_LOOKAHEAD);
  for (let row = from; row < limit; row += 1) {
    if ((lines[row] ?? '').includes(COMMENT_CLOSE)) {
      return row;
    }
  }
  return -1;
};

const scanInline = ({ lines, index, depth }: ScanParams): ScanResult => {
  const line = (lines[index] ?? '').slice(0, MAX_LINE);
  let out = '';
  let nextLine = index + 1;
  let i = 0;
  let nextGt = -2;
  while (i < line.length) {
    const char = line[i];
    if (char === '`') {
      let run = 1;
      while (line[i + run] === '`') {
        run += 1;
      }
      const delimiter = '`'.repeat(run);
      const close = line.indexOf(delimiter, i + run);
      if (close < 0) {
        out += delimiter;
        i += run;
        continue;
      }
      out += line.slice(i + run, close).trim();
      i = close + run;
      continue;
    }
    if (line.startsWith(COMMENT_OPEN, i)) {
      const close = line.indexOf(COMMENT_CLOSE, i + COMMENT_OPEN.length);
      if (close >= 0) {
        i = close + COMMENT_CLOSE.length;
        continue;
      }
      const row = commentCloseRowOf({ lines, from: index + 1 });
      if (row >= 0) {
        const tail = lines[row] ?? '';
        out += ` ${tail.slice(tail.indexOf(COMMENT_CLOSE) + COMMENT_CLOSE.length)}`;
        nextLine = row + 1;
      }
      i = line.length;
      continue;
    }
    if ((char === '!' && line[i + 1] === '[') || char === '[') {
      const ends = depth < MAX_NESTING ? linkEndsOf({ line, at: i }) : { label: -1, url: -1 };
      if (ends.url < 0) {
        out += char;
        i += 1;
        continue;
      }
      if (char === '[') {
        const inner = scanInline({
          lines: [line.slice(i + 1, ends.label)],
          index: 0,
          depth: depth + 1,
        });
        out += inner.text;
      }
      i = ends.url + 1;
      continue;
    }
    const isTag =
      char === '<' &&
      (isLetter({ char: line[i + 1] }) || (line[i + 1] === '/' && isLetter({ char: line[i + 2] })));
    if (isTag) {
      if (nextGt !== -1 && nextGt < i) {
        nextGt = line.indexOf('>', i);
      }
      if (nextGt >= 0) {
        out += ' ';
        i = nextGt + 1;
        continue;
      }
    }
    out += char;
    i += 1;
  }
  return { text: out, next: nextLine };
};

const withoutFencesOf = ({ lines }: LinesParams): ReadonlyArray<string> => {
  const kept: Array<string> = [];
  let fence: string | null = null;
  for (const line of lines) {
    const marker = FENCE_OPEN.exec(line)?.[1];
    if (fence === null) {
      fence = marker ?? null;
      kept.push(marker === undefined ? line : '');
      continue;
    }
    const isClose =
      marker !== undefined &&
      marker[0] === fence[0] &&
      marker.length >= fence.length &&
      line.trim() === marker;
    fence = isClose ? null : fence;
  }
  return kept;
};

type EmphasisParams = {
  readonly text: string;
};

const emphasisFreeOf = ({ text }: EmphasisParams): string =>
  text
    .replace(BOLD_RE, (_match, a: string | undefined, b: string | undefined) => a ?? b ?? '')
    .replace(ITALIC_RE, (_match, a: string | undefined, b: string | undefined) => a ?? b ?? '');

export const markdownPlainLinesOf = ({ text }: Params): ReadonlyArray<string> => {
  if (text == null) {
    return [];
  }
  const lines = withoutFencesOf({ lines: text.split('\n') });
  const out: Array<string> = [];
  let index = 0;
  while (index < lines.length) {
    const scanned = scanInline({ lines, index, depth: 0 });
    const flat = emphasisFreeOf({
      text: scanned.text.replace(/\s+/g, ' ').trim().replace(BLOCK_MARKER, ''),
    })
      .replace(/\s+/g, ' ')
      .trim();
    if (flat.length > 0) {
      out.push(flat);
    }
    index = scanned.next;
  }
  return out;
};

export const markdownPreview = ({ text }: Params): string =>
  markdownPlainLinesOf({ text }).join(' ');
