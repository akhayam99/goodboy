import { scanArtifactBlocks, type ArtifactBlock, type ArtifactBlockSpan } from './grammar';

const FENCE_LINE_RE = /^(?:`{3,}|~{3,})[ \t]*([A-Za-z0-9_-]*)[ \t]*$/;
const WRAPPER_FENCE_INFOS: ReadonlySet<string> = new Set([
  '',
  'json',
  'jsonc',
  'artifact',
  'markdown',
  'md',
]);
const OPEN_PREFIX = '<<artifact';
const CLOSE_LINE = '<</artifact>>';

type Line = {
  readonly start: number;
  readonly text: string;
};

const linesFrom = (text: string, from: number): ReadonlyArray<Line> => {
  const lines: Line[] = [];
  let start = from;
  while (start <= text.length) {
    const end = text.indexOf('\n', start);
    const stop = end === -1 ? text.length : end;
    lines.push({ start, text: text.slice(start, stop) });
    if (end === -1) {
      break;
    }
    start = end + 1;
  }
  return lines;
};

const lastCloseLineStart = (text: string, from: number): number | null => {
  const closes = linesFrom(text, from).filter((line) => line.text.trim() === CLOSE_LINE);
  return closes.at(-1)?.start ?? null;
};

const isWrapperFence = (line: string): boolean => {
  const match = FENCE_LINE_RE.exec(line.trim());
  return match !== null && WRAPPER_FENCE_INFOS.has((match[1] ?? '').toLowerCase());
};

const fencedEnvelopeStart = (text: string): number | null => {
  const lines = linesFrom(text, 0);
  for (let index = 0; index < lines.length; index += 1) {
    if (!isWrapperFence(lines[index]!.text)) {
      continue;
    }
    const next = lines.slice(index + 1).find((line) => line.text.trim().length > 0);
    if (next !== undefined && next.text.trimStart().startsWith(OPEN_PREFIX)) {
      return next.start;
    }
  }
  return null;
};

const toBlock = (text: string, span: ArtifactBlockSpan): ArtifactBlock => {
  if (span.complete) {
    return { attrs: span.attrs, body: text.slice(span.bodyStart, span.bodyEnd), complete: true };
  }
  const close = lastCloseLineStart(text, span.bodyStart);
  if (close === null) {
    return { attrs: span.attrs, body: text.slice(span.bodyStart), complete: false };
  }
  return {
    attrs: span.attrs,
    body: text.slice(span.bodyStart, Math.max(span.bodyStart, close - 1)),
    complete: true,
  };
};

const blocksOf = (text: string): ReadonlyArray<ArtifactBlock> =>
  scanArtifactBlocks({ text }).spans.map((span) => toBlock(text, span));

export const locateArtifactBlocks = (text: string): ReadonlyArray<ArtifactBlock> => {
  const blocks = blocksOf(text);
  if (blocks.length > 0) {
    return blocks;
  }
  const start = fencedEnvelopeStart(text);
  return start === null ? [] : blocksOf(text.slice(start));
};
