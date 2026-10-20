import { REVEAL_PACE } from './revealNumbers';

const WHITESPACE = /\s/;
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;
const TABLE_LINE = /^\s*\|/;
const DIVIDER_LINE = /^\|?:?-{2,}:?(\|:?-{2,}:?)*\|?$/;
const SPACES = /\s+/g;
const MAX_PASSES = 8;

type Params = {
  readonly text: string;
  readonly cut: number;
  readonly isComplete: boolean;
};

type CutParams = {
  readonly text: string;
  readonly cut: number;
};

type DelimiterParams = {
  readonly block: string;
  readonly delimiter: string;
};

const isBoundary = ({ text, cut }: CutParams): boolean =>
  cut <= 0 || WHITESPACE.test(text[cut] ?? '?');

const wordEnd = ({ text, cut }: CutParams): number => {
  let end = cut;
  while (end > 0 && !isBoundary({ text, cut: end })) {
    end -= 1;
  }
  return end;
};

const isInsideFence = ({ text, cut }: CutParams): boolean => {
  let isOpen = false;
  let openMarker = '';
  let lineStart = 0;
  while (lineStart < cut) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = newline === -1 || newline > cut ? cut : newline;
    const marker = FENCE_LINE.exec(text.slice(lineStart, lineEnd))?.[1];
    lineStart = lineEnd + 1;
    if (marker === undefined) {
      continue;
    }
    if (!isOpen) {
      isOpen = true;
      openMarker = marker;
      continue;
    }
    if (marker[0] === openMarker[0] && marker.length >= openMarker.length) {
      isOpen = false;
    }
  }
  return isOpen;
};

const lineEnd = ({ text, cut }: CutParams): number => {
  if (text[cut] === '\n') {
    return cut;
  }
  return Math.max(text.lastIndexOf('\n', cut - 1), 0);
};

const blockStart = ({ text, cut }: CutParams): number => {
  const gap = text.lastIndexOf('\n\n', cut - 1);
  return gap === -1 ? 0 : gap + 2;
};

const stripCodeSpans = (block: string): string =>
  block.replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length));

const unmatchedDelimiter = ({ block, delimiter }: DelimiterParams): number => {
  let last = -1;
  let count = 0;
  let at = block.indexOf(delimiter);
  while (at !== -1) {
    last = at;
    count += 1;
    at = block.indexOf(delimiter, at + delimiter.length);
  }
  return count % 2 === 1 ? last : -1;
};

const unclosedLink = (block: string): number => {
  const bracket = block.lastIndexOf('[');
  if (bracket === -1) {
    return -1;
  }
  const tail = block.slice(bracket);
  const isLinkClosed = /^\[[^\]]*\]\([^)]*\)/.test(tail);
  const isTextClosed = /^\[[^\]]*\](?!\()/.test(tail);
  return isLinkClosed || isTextClosed ? -1 : bracket;
};

const openInlineStart = ({ text, cut }: CutParams): number => {
  const start = blockStart({ text, cut });
  const block = text.slice(start, cut);
  if ((block.split('`').length - 1) % 2 === 1) {
    return start + block.lastIndexOf('`');
  }
  const bare = stripCodeSpans(block);
  const open = [
    unmatchedDelimiter({ block: bare, delimiter: '**' }),
    unmatchedDelimiter({ block: bare, delimiter: '__' }),
    unmatchedDelimiter({ block: bare, delimiter: '~~' }),
    unclosedLink(bare),
  ].filter((offset) => offset !== -1 && bare.length - offset <= REVEAL_PACE.maxHoldChars);
  return open.length === 0 ? -1 : start + Math.min(...open);
};

type Table = {
  readonly start: number;
  readonly end: number;
  readonly isReady: boolean;
};

type TableLine = {
  readonly text: string;
  readonly hasNewline: boolean;
};

type StepParams = CutParams & {
  readonly isComplete: boolean;
};

type TableLinesParams = {
  readonly text: string;
  readonly start: number;
};

const tableLinesFrom = ({ text, start }: TableLinesParams) => {
  const lines: TableLine[] = [];
  let end = start;
  let position = start;
  while (position <= text.length) {
    const newline = text.indexOf('\n', position);
    const stop = newline === -1 ? text.length : newline;
    const line = text.slice(position, stop);
    if (!TABLE_LINE.test(line)) {
      break;
    }
    lines.push({ text: line, hasNewline: newline !== -1 });
    end = stop;
    position = newline === -1 ? text.length + 1 : newline + 1;
  }
  const rest = position > text.length ? null : text.slice(position);
  const isClosed = rest !== null && (rest.includes('\n') || rest.trim() !== '');
  return { lines, end, isClosed };
};

const tableAt = ({ text, cut, isComplete }: StepParams): Table | null => {
  let start = text.lastIndexOf('\n', cut - 1) + 1;
  if (!TABLE_LINE.test(text.slice(start, cut))) {
    return null;
  }
  while (start > 0) {
    const previousStart = text.lastIndexOf('\n', start - 2) + 1;
    if (!TABLE_LINE.test(text.slice(previousStart, start - 1))) {
      break;
    }
    start = previousStart;
  }
  const { lines, end, isClosed: isTextClosed } = tableLinesFrom({ text, start });
  const isClosed = isTextClosed || isComplete;
  const second = lines[1];
  if (second === undefined) {
    return isClosed ? null : { start, end, isReady: false };
  }
  if (DIVIDER_LINE.test(second.text.replace(SPACES, ''))) {
    return { start, end, isReady: isClosed };
  }
  return second.hasNewline || isClosed ? null : { start, end, isReady: false };
};

const stepCut = ({ text, cut, isComplete }: StepParams): number => {
  const end = wordEnd({ text, cut });
  if (isInsideFence({ text, cut: end })) {
    return lineEnd({ text, cut: end });
  }
  const table = tableAt({ text, cut: end, isComplete });
  if (table !== null) {
    return table.isReady ? table.end : table.start;
  }
  const inline = openInlineStart({ text, cut: end });
  return inline === -1 ? end : inline;
};

export const healMarkdownPrefix = ({ text, cut, isComplete }: Params): string => {
  if (cut >= text.length && isComplete) {
    return text;
  }
  let end = Math.min(cut, text.length);
  for (let pass = 0; pass < MAX_PASSES && end > 0; pass += 1) {
    const next = stepCut({ text, cut: end, isComplete });
    if (next === end) {
      break;
    }
    end = next;
  }
  return text.slice(0, end);
};
