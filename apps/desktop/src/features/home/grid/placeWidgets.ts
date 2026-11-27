import { completeRows } from './completeRows';
import { isCovering, isFree, type Box } from './gridBoxes';
import { HOME_WIDGETS, type HomeWidgetId, type WidgetSize, type WidgetSpan } from './homeWidgets';

export type WidgetRequest = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

export type PlacedWidget = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
};

type Params = {
  readonly requests: ReadonlyArray<WidgetRequest>;
  readonly columns: number;
};

const SIZE_ORDER: ReadonlyArray<WidgetSize> = ['S', 'M', 'L'];

type SpanParams = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
  readonly columns: number;
};

const spanForSize = ({ id, size, columns }: SpanParams): WidgetSpan => {
  const spans = HOME_WIDGETS[id].spans;
  const span = spans[size] ?? spans[HOME_WIDGETS[id].defaultSize] ?? { cols: 1, rows: 2 };
  return { cols: Math.min(span.cols, columns), rows: span.rows };
};

type Cursor = {
  readonly col: number;
  readonly row: number;
};

type FirstFreeParams = {
  readonly boxes: ReadonlyArray<Box>;
  readonly from: Cursor;
  readonly cols: number;
  readonly rows: number;
  readonly columns: number;
};

const firstFreeOf = ({ boxes, from, cols, rows, columns }: FirstFreeParams): Cursor => {
  let { col, row } = from;
  while (!isFree({ boxes, col, row, cols, rows, columns })) {
    col += 1;
    if (col + cols > columns) {
      col = 0;
      row += 1;
    }
  }
  return { col, row };
};

type ContentParams = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
  readonly cols: number;
  readonly columns: number;
};

const contentSizeOf = ({ id, size, cols, columns }: ContentParams): WidgetSize => {
  const candidates = SIZE_ORDER.filter(
    (candidate) =>
      HOME_WIDGETS[id].spans[candidate] !== undefined &&
      spanForSize({ id, size: candidate, columns }).cols <= cols,
  );
  const largest = candidates[candidates.length - 1];
  const own = spanForSize({ id, size, columns }).cols;
  return largest !== undefined && cols > own ? largest : size;
};

export const placeWidgets = ({ requests, columns }: Params): ReadonlyArray<PlacedWidget> => {
  const boxes: Array<Box> = [];
  let cursor: Cursor = { col: 0, row: 0 };
  for (const request of requests) {
    const { cols, rows } = spanForSize({ id: request.id, size: request.size, columns });
    const at = firstFreeOf({ boxes, from: cursor, cols, rows, columns });
    boxes.push({ ...at, cols, rows });
    cursor = at;
  }
  completeRows({ boxes, columns });
  return requests.map((request, index) => {
    const box = boxes[index];
    if (box === undefined) {
      throw new Error('a placed widget lost its box');
    }
    return {
      id: request.id,
      size: contentSizeOf({ id: request.id, size: request.size, cols: box.cols, columns }),
      col: box.col,
      row: box.row,
      cols: box.cols,
      rows: box.rows,
    };
  });
};

type HolesParams = {
  readonly placed: ReadonlyArray<PlacedWidget>;
  readonly columns: number;
};

export const holesOf = ({ placed, columns }: HolesParams): ReadonlyArray<string> => {
  const bottom = Math.max(0, ...placed.map((widget) => widget.row + widget.rows));
  const holes: Array<string> = [];
  for (let row = 0; row < bottom; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const covers = placed.filter((widget) => isCovering({ box: widget, col, row })).length;
      if (covers !== 1) {
        holes.push(`${col},${row}:${covers}`);
      }
    }
  }
  return holes;
};
