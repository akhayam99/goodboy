import type { FileDiff } from '@goodboy/types';
import { windowRows } from './windowRows';

type Params = {
  readonly file: FileDiff;
  readonly isSplit: boolean;
  readonly visibleLines: number;
};

const LINE_ROW_PX = 20;
const MARKER_ROW_PX = 28;
const BODY_PADDING_PX = 8;
const EMPTY_BODY_PX = 96;

export const bodyEstimatePx = ({ file, isSplit, visibleLines }: Params): number => {
  if (file.binary || file.hunks.length === 0) {
    return EMPTY_BODY_PX;
  }
  const rows = windowRows({ hunks: file.hunks, gaps: [], isSplit, visibleLines });
  const rowsPx = rows.reduce(
    (sum, row) => sum + (row.type === 'header' || row.type === 'gap' ? MARKER_ROW_PX : LINE_ROW_PX),
    0,
  );
  return rowsPx + BODY_PADDING_PX;
};
