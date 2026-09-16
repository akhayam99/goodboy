export const ARTIFACT_SCHEMA_VERSION = 1;

export const ARTIFACT_MAX_BYTES = 512 * 1024;

const OPEN_MARKER = '<<artifact';
const MARKER_END = '>>';
const CLOSE_STICKY_RE = /[ \t]*<<\/artifact>>[ \t]*/y;
const FENCE_STICKY_RE = /[ \t]*(`{3,}|~{3,})/y;
const WHITESPACE_CHAR_RE = /\s/;
const NAME_CHAR_RE = /[a-zA-Z-]/;

export type ArtifactBlock = {
  readonly attrs: Readonly<Record<string, string>>;
  readonly body: string;
  readonly complete: boolean;
};

export type ArtifactBlockSpan = {
  readonly attrs: Readonly<Record<string, string>>;
  readonly start: number;
  readonly bodyStart: number;
  readonly bodyEnd: number;
  readonly end: number;
  readonly complete: boolean;
};

export type ArtifactScanState = {
  readonly scanned: number;
  readonly fence: string | null;
  readonly open: {
    readonly attrs: Readonly<Record<string, string>>;
    readonly start: number;
    readonly bodyStart: number;
  } | null;
  readonly spans: ReadonlyArray<ArtifactBlockSpan>;
};

export type ArtifactScanResult = {
  readonly spans: ReadonlyArray<ArtifactBlockSpan>;
  readonly state: ArtifactScanState;
};

type OpenSpan = NonNullable<ArtifactScanState['open']>;

type ScanParams = {
  readonly text: string;
  readonly from: number;
};

type ScannedValue = {
  readonly end: number;
  readonly value: string;
};

const isWhitespace = (char: string | undefined): boolean =>
  char !== undefined && WHITESPACE_CHAR_RE.test(char);

const isNameChar = (char: string | undefined): boolean =>
  char !== undefined && NAME_CHAR_RE.test(char);

const isIndent = (char: string | undefined): boolean => char === ' ' || char === '\t';

const scanWhile = ({
  text,
  from,
  accepts,
}: ScanParams & { readonly accepts: (char: string | undefined) => boolean }): number => {
  let index = from;
  while (index < text.length && accepts(text[index])) {
    index += 1;
  }
  return index;
};

const isBareValueChar = (char: string | undefined): boolean =>
  char !== undefined && !isWhitespace(char) && char !== '>';

const readQuotedValue = ({ text, from }: ScanParams): ScannedValue | null => {
  if (text[from] !== '"') {
    return null;
  }
  const close = text.indexOf('"', from + 1);
  if (close === -1) {
    return null;
  }
  return { end: close + 1, value: text.slice(from + 1, close) };
};

const readBareValue = ({ text, from }: ScanParams): ScannedValue | null => {
  const end = scanWhile({ text, from, accepts: isBareValueChar });
  if (end === from) {
    return null;
  }
  return { end, value: text.slice(from, end) };
};

const readOpenMarkerAttrs = (line: string): string | null => {
  const start = scanWhile({ text: line, from: 0, accepts: isIndent });
  if (!line.startsWith(OPEN_MARKER, start)) {
    return null;
  }
  const attrsStart = start + OPEN_MARKER.length;
  let index = attrsStart;
  for (;;) {
    const afterSpace = scanWhile({ text: line, from: index, accepts: isWhitespace });
    if (line.startsWith(MARKER_END, afterSpace)) {
      const tail = scanWhile({
        text: line,
        from: afterSpace + MARKER_END.length,
        accepts: isIndent,
      });
      return tail === line.length ? line.slice(attrsStart, index) : null;
    }
    if (afterSpace === index) {
      return null;
    }
    const nameEnd = scanWhile({ text: line, from: afterSpace, accepts: isNameChar });
    if (nameEnd === afterSpace || line[nameEnd] !== '=') {
      return null;
    }
    const valueStart = nameEnd + 1;
    const quoted = readQuotedValue({ text: line, from: valueStart });
    if (quoted !== null && (isWhitespace(line[quoted.end]) || line[quoted.end] === '>')) {
      index = quoted.end;
      continue;
    }
    const bare = readBareValue({ text: line, from: valueStart });
    if (bare === null) {
      return null;
    }
    index = bare.end;
  }
};

const parseAttrs = (raw: string): Readonly<Record<string, string>> => {
  const attrs: Record<string, string> = {};
  let index = 0;
  while (index < raw.length) {
    if (!isNameChar(raw[index])) {
      index += 1;
      continue;
    }
    const nameEnd = scanWhile({ text: raw, from: index, accepts: isNameChar });
    if (raw[nameEnd] !== '=') {
      index = nameEnd;
      continue;
    }
    const name = raw.slice(index, nameEnd).toLowerCase();
    const valueStart = nameEnd + 1;
    const quoted = readQuotedValue({ text: raw, from: valueStart });
    if (quoted !== null) {
      attrs[name] = quoted.value;
      index = quoted.end;
      continue;
    }
    const bare = readBareValue({ text: raw, from: valueStart });
    if (bare === null) {
      index = valueStart;
      continue;
    }
    attrs[name] = bare.value;
    index = bare.end;
  }
  return attrs;
};

type LineParams = {
  readonly text: string;
  readonly lineStart: number;
  readonly lineEnd: number;
};

const fenceRunAt = ({ text, from }: ScanParams): string | null => {
  FENCE_STICKY_RE.lastIndex = from;
  const match = FENCE_STICKY_RE.exec(text);
  return match === null ? null : match[1]!;
};

const isCloseLine = ({ text, lineStart, lineEnd }: LineParams): boolean => {
  CLOSE_STICKY_RE.lastIndex = lineStart;
  return CLOSE_STICKY_RE.test(text) && CLOSE_STICKY_RE.lastIndex === lineEnd;
};

const openMarkerAttrsAt = ({ text, lineStart, lineEnd }: LineParams): string | null => {
  const indentEnd = scanWhile({ text, from: lineStart, accepts: isIndent });
  if (!text.startsWith(OPEN_MARKER, indentEnd)) {
    return null;
  }
  return readOpenMarkerAttrs(text.slice(lineStart, lineEnd));
};

type StepParams = LineParams & {
  readonly next: number;
  readonly fence: string | null;
  readonly open: OpenSpan | null;
  readonly spans: ArtifactBlockSpan[];
};

type StepResult = {
  readonly fence: string | null;
  readonly open: OpenSpan | null;
};

const stepLine = ({
  text,
  lineStart,
  lineEnd,
  next,
  fence,
  open,
  spans,
}: StepParams): StepResult => {
  if (fence !== null) {
    const run = fenceRunAt({ text, from: lineStart });
    const closed = run !== null && run[0] === fence[0] && run.length >= fence.length;
    return { fence: closed ? null : fence, open };
  }

  if (open === null) {
    const fenceStart = fenceRunAt({ text, from: lineStart });
    if (fenceStart !== null) {
      return { fence: fenceStart, open: null };
    }
    const attrSource = openMarkerAttrsAt({ text, lineStart, lineEnd });
    if (attrSource === null) {
      return { fence: null, open: null };
    }
    return {
      fence: null,
      open: { attrs: parseAttrs(attrSource), start: lineStart, bodyStart: next },
    };
  }

  if (isCloseLine({ text, lineStart, lineEnd })) {
    spans.push({
      attrs: open.attrs,
      start: open.start,
      bodyStart: open.bodyStart,
      bodyEnd: Math.max(open.bodyStart, lineStart - 1),
      end: next,
      complete: true,
    });
    return { fence: null, open: null };
  }

  return { fence: fenceRunAt({ text, from: lineStart }), open };
};

type ScanArtifactBlocksParams = {
  readonly text: string;
  readonly from?: ArtifactScanState | null;
};

export const scanArtifactBlocks = ({
  text,
  from = null,
}: ScanArtifactBlocksParams): ArtifactScanResult => {
  const resumable = from !== null && from.scanned <= text.length ? from : null;
  const spans: ArtifactBlockSpan[] = resumable !== null ? resumable.spans.slice() : [];
  let fence: string | null = resumable !== null ? resumable.fence : null;
  let open: OpenSpan | null = resumable !== null ? resumable.open : null;
  let lineStart = resumable !== null ? resumable.scanned : 0;

  for (;;) {
    const lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) {
      break;
    }
    const step = stepLine({
      text,
      lineStart,
      lineEnd,
      next: lineEnd + 1,
      fence,
      open,
      spans,
    });
    fence = step.fence;
    open = step.open;
    lineStart = lineEnd + 1;
  }

  const state: ArtifactScanState = {
    scanned: lineStart,
    fence,
    open,
    spans: spans.slice(),
  };

  if (lineStart < text.length) {
    const step = stepLine({
      text,
      lineStart,
      lineEnd: text.length,
      next: text.length,
      fence,
      open,
      spans,
    });
    open = step.open;
  }

  if (open !== null) {
    spans.push({
      attrs: open.attrs,
      start: open.start,
      bodyStart: open.bodyStart,
      bodyEnd: text.length,
      end: text.length,
      complete: false,
    });
  }

  return { spans, state };
};

export const extractArtifactBlocks = (text: string): ReadonlyArray<ArtifactBlock> =>
  scanArtifactBlocks({ text }).spans.map((span) => ({
    attrs: span.attrs,
    body: text.slice(span.bodyStart, span.bodyEnd),
    complete: span.complete,
  }));
