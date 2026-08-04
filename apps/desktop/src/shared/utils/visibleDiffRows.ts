import type { DiffRow } from './diffRows';

type Params = {
  readonly rows: ReadonlyArray<DiffRow>;
  readonly visibleLines: number;
};

const sourceLineCount = (row: DiffRow): number => {
  if (row.type === 'header') {
    return 0;
  }
  return 1;
};

export const visibleDiffRows = ({ rows, visibleLines }: Params): ReadonlyArray<DiffRow> => {
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
