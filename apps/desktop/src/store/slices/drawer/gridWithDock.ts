import { gridAfterOpen } from './gridAfterOpen';
import type { DrawerGrid, OpenDrawer } from './state';

type Params = {
  readonly grid: DrawerGrid;
  readonly dock: OpenDrawer | null;
};

export const gridWithDock = ({ grid, dock }: Params): DrawerGrid => {
  if (dock === null || grid.columns.some((column) => column.includes(dock))) {
    return grid;
  }
  return { ...gridAfterOpen({ grid, entry: dock }), focus: grid.focus };
};
