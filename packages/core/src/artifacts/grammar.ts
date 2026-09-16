export const ARTIFACT_SCHEMA_VERSION = 1;

export const ARTIFACT_MAX_BYTES = 512 * 1024;

const OPEN_MARKER = '<<artifact';
const MARKER_END = '>>';
const CLOSE_RE = /^[ \t]*<<\/artifact>>[ \t]*$/;
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})/;
const WHITESPACE_CHAR_RE = /\s/;
const NAME_CHAR_RE = /[a-zA-Z-]/;

export type ArtifactBlock = {
  readonly attrs: Readonly<Record<string, string>>;
  readonly body: string;
  readonly complete: boolean;
};

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

const fenceRun = (line: string): string | null => {
  const match = FENCE_RE.exec(line);
  return match === null ? null : match[1]!;
};

const closesFence = ({ line, open }: { readonly line: string; readonly open: string }): boolean => {
  const run = fenceRun(line);
  return run !== null && run[0] === open[0] && run.length >= open.length;
};

export const extractArtifactBlocks = (text: string): ReadonlyArray<ArtifactBlock> => {
  const lines = text.split('\n');
  const out: ArtifactBlock[] = [];
  let fence: string | null = null;
  let open: { readonly attrs: Readonly<Record<string, string>>; readonly body: string[] } | null =
    null;

  for (const line of lines) {
    if (fence !== null) {
      if (closesFence({ line, open: fence })) {
        fence = null;
      }
      if (open !== null) {
        open.body.push(line);
      }
      continue;
    }
    if (open === null) {
      const fenceStart = fenceRun(line);
      if (fenceStart !== null) {
        fence = fenceStart;
        continue;
      }
      const attrSource = readOpenMarkerAttrs(line);
      if (attrSource !== null) {
        open = { attrs: parseAttrs(attrSource), body: [] };
      }
      continue;
    }
    if (CLOSE_RE.test(line)) {
      out.push({ attrs: open.attrs, body: open.body.join('\n'), complete: true });
      open = null;
      continue;
    }
    const fenceStart = fenceRun(line);
    if (fenceStart !== null) {
      fence = fenceStart;
    }
    open.body.push(line);
  }

  if (open !== null) {
    out.push({ attrs: open.attrs, body: open.body.join('\n'), complete: false });
  }
  return out;
};
