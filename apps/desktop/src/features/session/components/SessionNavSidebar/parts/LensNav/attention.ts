import type { LensRow } from './groups';

type Params = {
  readonly rows: ReadonlyArray<LensRow>;
};

export const rowsWantAttention = ({ rows }: Params): boolean =>
  rows.some((row) => {
    if (row.dot != null || row.secondaryDot === true) {
      return true;
    }
    if (row.count == null || row.count === 0) {
      return false;
    }
    return row.tone === 'warning' || row.tone === 'danger';
  });
