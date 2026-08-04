import type { DiffPairRow } from './diffPairRows';
import type { DiffRow } from './diffRows';

type AnyDiffRow = DiffRow | DiffPairRow;

type Params<R extends AnyDiffRow> = {
  readonly rows: ReadonlyArray<R>;
  readonly visibleLines: number;
};

const sourceLineCount = (row: AnyDiffRow): number => {
  if (row.type === 'header') {
    return 0;
  }
  if (row.type === 'line') {
    return 1;
  }
  if (row.pair.old?.kind === 'context') {
    return 1;
  }
  return (row.pair.old === null ? 0 : 1) + (row.pair.new === null ? 0 : 1);
};

export const visibleDiffRows = <R extends AnyDiffRow>({
  rows,
  visibleLines,
}: Params<R>): ReadonlyArray<R> => {
  let count = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row == null) {
      continue;
    }
    count += sourceLineCount(row);
    if (count >= visibleLines) {
      return rows.slice(0, index + 1);
    }
  }
  return rows;
};
