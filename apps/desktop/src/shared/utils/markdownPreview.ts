type Params = {
  readonly text: string | null | undefined;
  readonly shouldKeepOpenFence?: boolean;
  readonly shouldKeepMarkers?: boolean;
};

const MAX_LINK_FAILURES = 8;
const MAX_NESTING = 3;
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const BLOCK_MARKER = /^(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d{1,9}\.[ \t]+)+/;
const BOLD_RE = /\*\*([^*]+)\*\*|__([^_]+)__/g;
const ITALIC_RE = /(?<![*\w])\*([^*]+)\*(?!\*)|(?<![_\w])_([^_]+)_(?!_)/g;

type ScanParams = {
  readonly line: string;
  readonly lineStart: number;
  readonly lastClose: number;
  readonly depth: number;
};

type ScanResult = {
  readonly text: string;
  readonly isCommentOpen: boolean;
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

type LineParams = {
  readonly line: string;
};

const bracketClosesOf = ({ line }: LineParams): Int32Array => {
  const closes = new Int32Array(line.length).fill(-1);
  const opens: Array<number> = [];
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (char === '[') {
      opens.push(i);
    }
    if (char === ']') {
      const open = opens.pop();
      if (open !== undefined) {
        closes[open] = i;
      }
    }
  }
  return closes;
};

type LinkParams = {
  readonly line: string;
  readonly at: number;
  readonly closes: Int32Array;
};

type LinkEnds = {
  readonly label: number;
  readonly url: number;
  readonly isExpensiveMiss: boolean;
};

const NO_LINK: LinkEnds = { label: -1, url: -1, isExpensiveMiss: false };

const linkEndsOf = ({ line, at, closes }: LinkParams): LinkEnds => {
  const label = closes[line[at] === '!' ? at + 1 : at] ?? -1;
  if (label < 0 || line[label + 1] !== '(') {
    return NO_LINK;
  }
  const url = balancedCloseOf({ line, from: label + 2 });
  return { label, url, isExpensiveMiss: url < 0 };
};

const scanInline = ({ line, lineStart, lastClose, depth }: ScanParams): ScanResult => {
  let out = '';
  let i = 0;
  let nextGt = -2;
  let linkFailures = 0;
  const failedRuns = new Set<number>();
  let closes: Int32Array | null = null;
  while (i < line.length) {
    const char = line[i];
    if (char === '`') {
      let run = 1;
      while (line[i + run] === '`') {
        run += 1;
      }
      const delimiter = '`'.repeat(run);
      const close = failedRuns.has(run) ? -1 : line.indexOf(delimiter, i + run);
      if (close < 0) {
        failedRuns.add(run);
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
      return { text: out, isCommentOpen: lastClose >= lineStart + i + COMMENT_OPEN.length };
    }
    if ((char === '!' && line[i + 1] === '[') || char === '[') {
      const isTried = depth < MAX_NESTING && linkFailures < MAX_LINK_FAILURES;
      closes ??= bracketClosesOf({ line });
      const ends = isTried ? linkEndsOf({ line, at: i, closes }) : NO_LINK;
      linkFailures += ends.isExpensiveMiss ? 1 : 0;
      if (ends.url < 0) {
        out += char;
        i += 1;
        continue;
      }
      if (char === '[') {
        out += scanInline({
          line: line.slice(i + 1, ends.label),
          lineStart: 0,
          lastClose: -1,
          depth: depth + 1,
        }).text;
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
  return { text: out, isCommentOpen: false };
};

type EmitParams = {
  readonly line: string;
  readonly start: number;
};

type FlatParams = {
  readonly text: string;
  readonly shouldKeepMarkers: boolean;
};

const flatLineOf = ({ text, shouldKeepMarkers }: FlatParams): string => {
  if (shouldKeepMarkers) {
    return text.replace(/\s+/g, ' ').trim();
  }
  const unmarked = text.replace(/\s+/g, ' ').trim().replace(BLOCK_MARKER, '');
  return emphasisFreeOf({ text: unmarked }).replace(/\s+/g, ' ').trim();
};

type EmphasisParams = {
  readonly text: string;
};

const emphasisFreeOf = ({ text }: EmphasisParams): string =>
  text
    .replace(BOLD_RE, (_match, a: string | undefined, b: string | undefined) => a ?? b ?? '')
    .replace(ITALIC_RE, (_match, a: string | undefined, b: string | undefined) => a ?? b ?? '');

export const markdownPlainLinesOf = ({
  text,
  shouldKeepOpenFence = true,
  shouldKeepMarkers = false,
}: Params): ReadonlyArray<string> => {
  if (text == null) {
    return [];
  }
  const lastClose = text.lastIndexOf(COMMENT_CLOSE);
  const out: Array<string> = [];
  let fence: string | null = null;
  let fenceLines: Array<EmitParams> = [];
  let isInComment = false;
  let lineStart = 0;
  const emit = ({ line, start }: EmitParams): void => {
    const scanned = scanInline({ line, lineStart: start, lastClose, depth: 0 });
    isInComment = scanned.isCommentOpen;
    const flat = flatLineOf({ text: scanned.text, shouldKeepMarkers });
    if (flat.length > 0) {
      out.push(flat);
    }
  };
  for (const line of text.split('\n')) {
    const start = lineStart;
    lineStart += line.length + 1;
    if (isInComment) {
      const close = line.indexOf(COMMENT_CLOSE);
      isInComment = close < 0;
      if (close >= 0) {
        emit({
          line: line.slice(close + COMMENT_CLOSE.length),
          start: start + close + COMMENT_CLOSE.length,
        });
      }
      continue;
    }
    const marker = FENCE_OPEN.exec(line)?.[1];
    if (fence === null) {
      if (marker === undefined) {
        emit({ line, start });
        continue;
      }
      fence = marker;
      fenceLines = [];
      continue;
    }
    const isClose =
      marker !== undefined &&
      marker[0] === fence[0] &&
      marker.length >= fence.length &&
      line.trim() === marker;
    if (isClose) {
      fence = null;
      continue;
    }
    fenceLines.push({ line, start });
  }
  if (fence !== null && shouldKeepOpenFence) {
    fenceLines.forEach((entry) => emit(entry));
  }
  return out;
};

export const markdownPreview = ({ text, shouldKeepOpenFence = true }: Params): string =>
  markdownPlainLinesOf({ text, shouldKeepOpenFence }).join(' ');
