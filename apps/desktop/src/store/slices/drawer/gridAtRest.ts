import { gridAfterOpen } from './gridAfterOpen';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from './state';
import { toolsByUseOf } from './toolsByUseOf';

type Params = {
  readonly grid: DrawerGrid;
};

export const gridAtRest = ({ grid }: Params): DrawerGrid => {
  const opened = toolsByUseOf({ grid }).reduce(
    (built, entry) => gridAfterOpen({ grid: built, entry }),
    EMPTY_DRAWER_GRID,
  );
  return { ...opened, used: grid.used, focus: grid.focus };
};
