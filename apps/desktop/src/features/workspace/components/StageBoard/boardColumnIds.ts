type Params = {
  readonly key: string;
};

export const boardColumnIds = ({ key }: Params) => ({
  column: `board-column-${key}`,
  collapse: `board-collapse-${key}`,
  dock: `board-dock-${key}`,
});
