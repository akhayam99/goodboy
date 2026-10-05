import type { TreeRow } from './changeTree';

const ROW_PX = 28;
const ROW_WITH_SOURCE_PX = 44;
export const WINDOW_MIN_ROWS = 120;
const OVERSCAN_PX = 280;
const FALLBACK_VIEWPORT_PX = 800;

export const rowHeightOf = (row: TreeRow): number =>
  row.kind === 'file' && row.fromPath !== null ? ROW_WITH_SOURCE_PX : ROW_PX;

export type RowLayout = {
  readonly offsets: ReadonlyArray<number>;
  readonly total: number;
};

export const layoutRows = (rows: ReadonlyArray<TreeRow>): RowLayout => {
  const offsets: number[] = [];
  let total = 0;
  for (const row of rows) {
    offsets.push(total);
    total += rowHeightOf(row);
  }
  return { offsets, total };
};

type WindowParams = {
  readonly layout: RowLayout;
  readonly count: number;
  readonly scrollTop: number;
  readonly viewport: number;
};

export type RowWindow = {
  readonly start: number;
  readonly end: number;
};

export const windowOf = ({ layout, count, scrollTop, viewport }: WindowParams): RowWindow => {
  const from = Math.max(0, scrollTop - OVERSCAN_PX);
  const to = scrollTop + (viewport > 0 ? viewport : FALLBACK_VIEWPORT_PX) + OVERSCAN_PX;
  let low = 0;
  let high = count;
  while (low < high) {
    const mid = (low + high) >> 1;
    const isAbove = (layout.offsets[mid] ?? 0) + ROW_PX <= from;
    low = isAbove ? mid + 1 : low;
    high = isAbove ? high : mid;
  }
  let end = low;
  while (end < count && (layout.offsets[end] ?? 0) < to) {
    end += 1;
  }
  return { start: low, end };
};

type RevealParams = {
  readonly layout: RowLayout;
  readonly index: number;
  readonly rowPx: number;
  readonly scrollTop: number;
  readonly viewport: number;
};

export const scrollTopToReveal = ({
  layout,
  index,
  rowPx,
  scrollTop,
  viewport,
}: RevealParams): number => {
  const top = layout.offsets[index];
  if (top === undefined || viewport <= 0) {
    return scrollTop;
  }
  if (top < scrollTop) {
    return top;
  }
  const bottom = top + rowPx;
  return bottom > scrollTop + viewport ? bottom - viewport : scrollTop;
};
