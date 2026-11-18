import type { DrawerGrid, OpenDrawer } from './state';

type Params = {
  readonly grid: DrawerGrid;
  readonly kinds: ReadonlyArray<OpenDrawer['kind']>;
};

export const gridWithout = ({ grid, kinds }: Params): DrawerGrid => {
  if (!grid.columns.some((column) => column.some((panel) => kinds.includes(panel.kind)))) {
    return grid;
  }
  return {
    columns: grid.columns
      .map((column) => column.filter((panel) => !kinds.includes(panel.kind)))
      .filter((column) => column.length > 0),
    used: grid.used.filter((kind) => !kinds.includes(kind)),
    focus: grid.focus,
    widths: grid.widths,
  };
};
