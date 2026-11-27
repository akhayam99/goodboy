export type Box = {
  col: number;
  row: number;
  cols: number;
  rows: number;
};

type BoxParams = {
  readonly box: Box;
};

type CellParams = BoxParams & {
  readonly col: number;
  readonly row: number;
};

type FreeParams = {
  readonly boxes: ReadonlyArray<Box>;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
  readonly columns: number;
};

export const bottomOf = ({ box }: BoxParams): number => box.row + box.rows;

export const isCovering = ({ box, col, row }: CellParams): boolean =>
  col >= box.col && col < box.col + box.cols && row >= box.row && row < box.row + box.rows;

export const isFree = ({ boxes, col, row, cols, rows, columns }: FreeParams): boolean => {
  if (col < 0 || col + cols > columns) {
    return false;
  }
  for (let r = row; r < row + rows; r += 1) {
    for (let c = col; c < col + cols; c += 1) {
      if (boxes.some((box) => isCovering({ box, col: c, row: r }))) {
        return false;
      }
    }
  }
  return true;
};
