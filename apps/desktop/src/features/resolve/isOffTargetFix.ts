import type { DiffHunk, FileDiff } from '@goodboy/types';

const NEAR_LINES = 40;

type Params = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly path: string | null;
  readonly line: number | null;
};

type HunkParams = {
  readonly hunk: DiffHunk;
  readonly line: number;
};

type RangeParams = {
  readonly start: number;
  readonly count: number;
  readonly line: number;
};

const isWithin = ({ start, count, line }: RangeParams): boolean =>
  line >= start - NEAR_LINES && line <= start + count + NEAR_LINES;

const isHunkNear = ({ hunk, line }: HunkParams): boolean =>
  isWithin({ start: hunk.newStart, count: hunk.newLines, line }) ||
  isWithin({ start: hunk.oldStart, count: hunk.oldLines, line });

export const isOffTargetFix = ({ files, path, line }: Params): boolean => {
  if (path === null || path === '' || files.length === 0) {
    return false;
  }
  const file = files.find((item) => item.path === path || item.oldPath === path);
  if (file === undefined) {
    return true;
  }
  if (line === null || file.binary || file.hunks.length === 0) {
    return false;
  }
  return !file.hunks.some((hunk) => isHunkNear({ hunk, line }));
};
