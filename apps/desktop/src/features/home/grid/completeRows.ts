import { bottomOf, isFree, type Box } from './gridBoxes';

type Params = {
  readonly boxes: Array<Box>;
  readonly columns: number;
};

type PairParams = {
  readonly first: Box;
  readonly second: Box;
};

const widenRight = ({ boxes, columns }: Params): boolean => {
  let isChanged = false;
  for (const box of boxes) {
    const right = box.col + box.cols;
    const extra = columns - right;
    if (
      extra > 0 &&
      isFree({ boxes, col: right, row: box.row, cols: extra, rows: box.rows, columns })
    ) {
      box.cols += extra;
      isChanged = true;
    }
  }
  return isChanged;
};

const isBeside = ({ first, second }: PairParams): boolean => {
  const isAdjacent =
    first.col + first.cols === second.col || second.col + second.cols === first.col;
  const isOverlapping =
    first.row < bottomOf({ box: second }) && second.row < bottomOf({ box: first });
  return isAdjacent && isOverlapping;
};

const stretchDown = ({ boxes, columns }: Params): boolean => {
  let isChanged = false;
  for (const box of boxes) {
    const target = Math.max(
      bottomOf({ box }),
      ...boxes
        .filter((other) => other !== box && isBeside({ first: box, second: other }))
        .map((other) => bottomOf({ box: other })),
    );
    const extra = target - bottomOf({ box });
    if (
      extra > 0 &&
      isFree({ boxes, col: box.col, row: bottomOf({ box }), cols: box.cols, rows: extra, columns })
    ) {
      box.rows += extra;
      isChanged = true;
    }
  }
  return isChanged;
};

export const completeRows = ({ boxes, columns }: Params): void => {
  for (let pass = 0; pass < boxes.length + 2; pass += 1) {
    const isWidened = widenRight({ boxes, columns });
    const isStretched = stretchDown({ boxes, columns });
    if (!isWidened && !isStretched) {
      return;
    }
  }
};
