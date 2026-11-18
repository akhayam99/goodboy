import { EMPTY_DRAWER_GRID } from './state';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

export const clearDrawer = ({ set }: Params) => {
  return (): void => {
    set((state) =>
      state.drawer === null &&
      state.drawerBack === null &&
      (state.drawerGrid ?? EMPTY_DRAWER_GRID).columns.length === 0
        ? state
        : { drawer: null, drawerBack: null, drawerGrid: EMPTY_DRAWER_GRID },
    );
  };
};
