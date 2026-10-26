import type { DiffHunk, DiffHunkLine } from '@goodboy/types';
import { buildDiffRows, type DiffRow } from './diffRows';
import { buildDiffPairRows, type DiffPairRow } from './diffPairRows';
import { visibleDiffRows } from './visibleDiffRows';
import type { ContextGap } from './contextGaps';

type Params = {
  readonly hunks: ReadonlyArray<DiffHunk>;
  readonly gaps: ReadonlyArray<ContextGap>;
  readonly isSplit: boolean;
  readonly visibleLines: number;
};

type AppendGapParams = { readonly gap: ContextGap | undefined };

type ContextRowsParams = {
  readonly lines: ReadonlyArray<DiffHunkLine>;
  readonly index: number;
  readonly isSplit: boolean;
};

const contextRows = ({
  lines,
  index,
  isSplit,
}: ContextRowsParams): ReadonlyArray<DiffRow | DiffPairRow> =>
  lines.map((line) =>
    isSplit
      ? {
          type: 'pair',
          hunkIndex: -index - 1,
          rowIndex: line.newLine ?? line.oldLine ?? 0,
          pair: { old: line, new: line },
        }
      : { type: 'line', hunkIndex: -index - 1, rowIndex: line.newLine ?? line.oldLine ?? 0, line },
  );

export const windowRows = ({
  hunks,
  gaps,
  isSplit,
  visibleLines,
}: Params): ReadonlyArray<DiffRow | DiffPairRow | ContextGap> => {
  const original = visibleDiffRows<DiffRow | DiffPairRow>({
    rows: isSplit ? buildDiffPairRows({ hunks }) : buildDiffRows({ hunks }),
    visibleLines,
  });
  const rows: (DiffRow | DiffPairRow | ContextGap)[] = [];
  const appendGap = ({ gap }: AppendGapParams) => {
    if (gap === undefined) {
      return;
    }
    rows.push(...contextRows({ lines: gap.before, index: gap.index, isSplit }));
    if (gap.count === null || gap.count > 0) {
      rows.push(gap);
    }
    rows.push(...contextRows({ lines: gap.after, index: gap.index, isSplit }));
  };
  for (const row of original) {
    if (row.type === 'header') {
      appendGap({ gap: gaps[row.hunkIndex] });
    }
    rows.push(row);
  }
  const sourceCount = hunks.reduce((count, hunk) => count + hunk.lines.length, 0);
  if (visibleLines >= sourceCount) {
    appendGap({ gap: gaps[hunks.length] });
  }
  return rows;
};
