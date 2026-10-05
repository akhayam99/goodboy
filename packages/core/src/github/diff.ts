import type { DiffHunk, DiffHunkLine, FileDiff, FileDiffStatus } from '@goodboy/types';

type MutableFile = {
  path: string;
  oldPath?: string;
  status: FileDiffStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: DiffHunk[];
};

const FILE_HEADER_PREFIX = 'diff --git a/';
const FILE_HEADER_SEPARATOR = ' b/';
const FILE_HEADER_WORDS = 'diff --git ';
const QUOTED_NEW_SEPARATOR = ' "b/';
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const SIMPLE_ESCAPES: Readonly<Record<string, number>> = {
  a: 7,
  b: 8,
  f: 12,
  n: 10,
  r: 13,
  t: 9,
  v: 11,
  '"': 34,
  '\\': 92,
};

const unquoteGitPath = ({ text }: { readonly text: string }): string => {
  const encoder = new TextEncoder();
  const bytes: number[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text.charAt(index);
    if (char !== '\\') {
      const point = text.codePointAt(index) ?? 0;
      const literal = String.fromCodePoint(point);
      bytes.push(...encoder.encode(literal));
      index += literal.length;
      continue;
    }
    const octal = text.slice(index + 1, index + 4);
    if (/^[0-3][0-7]{2}$/.test(octal)) {
      bytes.push(Number.parseInt(octal, 8));
      index += 4;
      continue;
    }
    const simple = SIMPLE_ESCAPES[text.charAt(index + 1)];
    bytes.push(simple ?? 92);
    index += simple === undefined ? 1 : 2;
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
};

const closingQuoteAt = ({
  text,
  from,
}: {
  readonly text: string;
  readonly from: number;
}): number => {
  for (let index = from + 1; index < text.length; index += 1) {
    if (text.charAt(index) === '\\') {
      index += 1;
      continue;
    }
    if (text.charAt(index) === '"') {
      return index;
    }
  }
  return -1;
};

const gitPathValue = ({ text }: { readonly text: string }): string =>
  text.startsWith('"') && text.endsWith('"') && text.length >= 2
    ? unquoteGitPath({ text: text.slice(1, -1) })
    : text;

type HeaderPaths = { readonly oldPath: string; readonly newPath: string };

const splitQuotedHeader = ({
  rest,
}: {
  readonly rest: string;
}): { readonly oldText: string; readonly newText: string } | null => {
  if (rest.startsWith('"')) {
    const close = closingQuoteAt({ text: rest, from: 0 });
    if (close < 0 || rest.charAt(close + 1) !== ' ') {
      return null;
    }
    return { oldText: rest.slice(0, close + 1), newText: rest.slice(close + 2) };
  }
  const split = rest.indexOf(QUOTED_NEW_SEPARATOR);
  if (split < 0) {
    return null;
  }
  return { oldText: rest.slice(0, split), newText: rest.slice(split + 1) };
};

const quotedHeaderPaths = ({ line }: { readonly line: string }): HeaderPaths | null => {
  const parts = splitQuotedHeader({ rest: line.slice(FILE_HEADER_WORDS.length) });
  if (parts === null) {
    return null;
  }
  const oldValue = gitPathValue({ text: parts.oldText });
  const newValue = gitPathValue({ text: parts.newText });
  if (!oldValue.startsWith('a/') || !newValue.startsWith('b/')) {
    return null;
  }
  return { oldPath: oldValue.slice(2), newPath: newValue.slice(2) };
};

const plainHeaderPaths = ({ line }: { readonly line: string }): HeaderPaths | null => {
  const separatorIndex = line.lastIndexOf(FILE_HEADER_SEPARATOR);
  if (separatorIndex <= FILE_HEADER_PREFIX.length) {
    return null;
  }
  return {
    oldPath: line.slice(FILE_HEADER_PREFIX.length, separatorIndex),
    newPath: line.slice(separatorIndex + FILE_HEADER_SEPARATOR.length),
  };
};

const isQuotedHeader = ({ line }: { readonly line: string }): boolean =>
  line.startsWith(FILE_HEADER_WORDS) && line.includes('"');

const isFileHeader = ({ line }: { readonly line: string }): boolean =>
  line.startsWith(FILE_HEADER_PREFIX) || isQuotedHeader({ line });

const headerPaths = ({ line }: { readonly line: string }): HeaderPaths | null =>
  isQuotedHeader({ line }) ? quotedHeaderPaths({ line }) : plainHeaderPaths({ line });

export const parseUnifiedDiff = (diff: string): ReadonlyArray<FileDiff> => {
  const lines = diff.split('\n');
  const files: MutableFile[] = [];
  let current: MutableFile | null = null;
  let hunk: {
    header: string;
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffHunkLine[];
  } | null = null;
  let oldCursor = 0;
  let newCursor = 0;

  const flushHunk = () => {
    if (current && hunk) {
      current.hunks.push({
        header: hunk.header,
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
        lines: hunk.lines,
      });
    }
    hunk = null;
  };

  for (const line of lines) {
    if (isFileHeader({ line })) {
      const paths = headerPaths({ line });
      if (paths === null || paths.newPath.length === 0) {
        continue;
      }
      const { oldPath, newPath } = paths;
      flushHunk();
      if (current) {
        files.push(current);
      }
      current = {
        path: newPath,
        oldPath: oldPath === newPath ? undefined : oldPath,
        status: 'modified',
        additions: 0,
        deletions: 0,
        binary: false,
        hunks: [],
      };
      continue;
    }
    if (!current) {
      continue;
    }

    if (line.startsWith('new file mode')) {
      current.status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      current.status = 'deleted';
    } else if (line.startsWith('rename from')) {
      current.status = 'renamed';
      current.oldPath = gitPathValue({ text: line.slice('rename from '.length) });
    } else if (line.startsWith('rename to')) {
      current.path = gitPathValue({ text: line.slice('rename to '.length) });
    } else if (line.startsWith('Binary files')) {
      current.binary = true;
    }

    const hunkMatch = line.match(HUNK_HEADER);
    if (hunkMatch && hunkMatch[1] && hunkMatch[3]) {
      flushHunk();
      const oldStart = Number.parseInt(hunkMatch[1], 10);
      const oldLines = hunkMatch[2] ? Number.parseInt(hunkMatch[2], 10) : 1;
      const newStart = Number.parseInt(hunkMatch[3], 10);
      const newLines = hunkMatch[4] ? Number.parseInt(hunkMatch[4], 10) : 1;
      hunk = {
        header: line,
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: [],
      };
      oldCursor = oldStart;
      newCursor = newStart;
      continue;
    }

    if (!hunk) {
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      hunk.lines.push({ kind: 'add', oldLine: null, newLine: newCursor, text: line.slice(1) });
      current.additions += 1;
      newCursor += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      hunk.lines.push({ kind: 'del', oldLine: oldCursor, newLine: null, text: line.slice(1) });
      current.deletions += 1;
      oldCursor += 1;
    } else if (line.startsWith(' ')) {
      hunk.lines.push({
        kind: 'context',
        oldLine: oldCursor,
        newLine: newCursor,
        text: line.slice(1),
      });
      oldCursor += 1;
      newCursor += 1;
    } else if (line.startsWith('\\ No newline')) {
    }
  }

  flushHunk();
  if (current) {
    files.push(current);
  }
  return files;
};
