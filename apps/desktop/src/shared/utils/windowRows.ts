export const WINDOW_MIN_ROWS = 120;
const OVERSCAN_PX = 280;
const FALLBACK_VIEWPORT_PX = 800;

export type RowLayout = {
  readonly offsets: ReadonlyArray<number>;
  readonly total: number;
};

type LayoutParams<Row> = {
  readonly rows: ReadonlyArray<Row>;
  readonly heightOf: (row: Row) => number;
};

export const layoutRows = <Row>({ rows, heightOf }: LayoutParams<Row>): RowLayout => {
  const offsets: number[] = [];
  let total = 0;
  for (const row of rows) {
    offsets.push(total);
    total += heightOf(row);
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
    const isAbove = (layout.offsets[mid + 1] ?? layout.total) <= from;
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
