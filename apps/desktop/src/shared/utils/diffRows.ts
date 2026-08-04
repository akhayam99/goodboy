import type { DiffHunk, DiffHunkLine } from '@goodboy/types';
import { hunkLabel } from './hunkLabel';

export type DiffRow =
  | { readonly type: 'header'; readonly hunkIndex: number; readonly header: string }
  | {
      readonly type: 'line';
      readonly hunkIndex: number;
      readonly rowIndex: number;
      readonly line: DiffHunkLine;
    };

type Params = {
  readonly hunks: ReadonlyArray<DiffHunk>;
};

export const buildDiffRows = ({ hunks }: Params): ReadonlyArray<DiffRow> => {
  const rows: DiffRow[] = [];
  hunks.forEach((hunk, hunkIndex) => {
    rows.push({ type: 'header', hunkIndex, header: hunkLabel({ hunk }) });
    hunk.lines.forEach((line, rowIndex) => rows.push({ type: 'line', hunkIndex, rowIndex, line }));
  });
  return rows;
};
