export type HomeColumns = 1 | 2 | 4;

export const FOUR_COLUMNS_FROM_PX = 800;

export const TWO_COLUMNS_FROM_PX = 440;

type Params = {
  readonly widthPx: number;
};

export const columnsOf = ({ widthPx }: Params): HomeColumns => {
  if (widthPx >= FOUR_COLUMNS_FROM_PX) {
    return 4;
  }
  return widthPx >= TWO_COLUMNS_FROM_PX ? 2 : 1;
};
