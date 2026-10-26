export type FileLinkMatch = {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly path: string;
  readonly line: number | null;
  readonly column: number | null;
};

type Params = {
  readonly text: string;
};

const FILE_LINK =
  /(?<![\w./@~:-])((?:\.{1,2}\/|\/)?(?:[\w@+.-]+\/)*[\w@+-][\w@+.-]*\.[A-Za-z][A-Za-z0-9]{0,7})(?::(\d+)(?::(\d+))?|\((\d+)(?:,\s*(\d+))?\))?(?![\w/])/g;

const MAX_LINE_LENGTH = 2000;

type NumberParams = {
  readonly value: string | undefined;
};

const numberOf = ({ value }: NumberParams): number | null => {
  if (value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 && parsed < 10_000_000 ? parsed : null;
};

export const fileLinkMatches = ({ text }: Params): ReadonlyArray<FileLinkMatch> => {
  const matches: FileLinkMatch[] = [];
  if (text.length > MAX_LINE_LENGTH) {
    return matches;
  }
  for (const found of text.matchAll(FILE_LINK)) {
    const path = found[1];
    if (path === undefined) {
      continue;
    }
    const line = numberOf({ value: found[2] ?? found[4] });
    const column = numberOf({ value: found[3] ?? found[5] });
    if (line === null && !path.includes('/')) {
      continue;
    }
    matches.push({
      startIndex: found.index,
      endIndex: found.index + found[0].length,
      path,
      line,
      column: line === null ? null : column,
    });
  }
  return matches;
};
