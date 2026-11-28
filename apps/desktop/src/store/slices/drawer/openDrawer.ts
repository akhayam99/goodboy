import { slotAfterOpen } from './slotAfterOpen';
import { EMPTY_DRAWER_GRID, type DrawerRequest } from './state';
import type { SetFn } from './types';

export const openDrawer = (set: SetFn) => {
  return (request: DrawerRequest): void => {
    set((state) =>
      slotAfterOpen({
        drawer: state.drawer ?? null,
        back: state.drawerBack ?? null,
        grid: state.drawerGrid ?? EMPTY_DRAWER_GRID,
        request,
      }),
    );
  };
};
