import type { DiffHunk } from '@goodboy/types';
import { pairDiffLines, type DiffLinePair } from './diffLinePairs';

export type DiffPairRow =
  | { readonly type: 'header'; readonly hunkIndex: number; readonly header: string }
  | {
      readonly type: 'pair';
      readonly hunkIndex: number;
      readonly rowIndex: number;
      readonly pair: DiffLinePair;
    };

type Params = {
  readonly hunks: ReadonlyArray<DiffHunk>;
};

export const buildDiffPairRows = ({ hunks }: Params): ReadonlyArray<DiffPairRow> => {
  const rows: DiffPairRow[] = [];
  hunks.forEach((hunk, hunkIndex) => {
    rows.push({ type: 'header', hunkIndex, header: hunk.header });
    pairDiffLines({ lines: hunk.lines }).forEach((pair, rowIndex) =>
      rows.push({ type: 'pair', hunkIndex, rowIndex, pair }),
    );
  });
  return rows;
};
