import type { DiffHunkLine, FileDiff } from '@goodboy/types';

export type HunkWindow = {
  readonly path: string;
  readonly from: number;
  readonly to: number;
  readonly lines: ReadonlyArray<DiffHunkLine>;
  readonly anchorLine: number | null;
};

type Params = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly path: string;
  readonly line: number | null;
  readonly radius?: number;
};

const DEFAULT_RADIUS = 3;

const lineNumberOf = (line: DiffHunkLine): number | null => line.newLine ?? line.oldLine;

export const hunkAround = ({
  files,
  path,
  line,
  radius = DEFAULT_RADIUS,
}: Params): HunkWindow | null => {
  const file = files.find(
    (candidate) => candidate.path === path || path.endsWith(`/${candidate.path}`),
  );
  if (file === undefined || line === null) {
    return null;
  }
  for (const hunk of file.hunks) {
    const at = hunk.lines.findIndex((candidate) => candidate.newLine === line);
    if (at < 0) {
      continue;
    }
    const lines = hunk.lines.slice(Math.max(0, at - radius), at + radius + 1);
    const numbers = lines.flatMap((candidate) => {
      const number = lineNumberOf(candidate);
      return number === null ? [] : [number];
    });
    return {
      path: file.path,
      from: Math.min(...numbers),
      to: Math.max(...numbers),
      lines,
      anchorLine: line,
    };
  }
  return null;
};
