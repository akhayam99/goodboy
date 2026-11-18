import type { DrawerGrid, OpenDrawer } from './state';

type Params = {
  readonly grid: DrawerGrid;
};

export const toolsByUseOf = ({ grid }: Params): ReadonlyArray<OpenDrawer> =>
  [...grid.columns.flat()].sort(
    (left, right) => grid.used.indexOf(left.kind) - grid.used.indexOf(right.kind),
  );
