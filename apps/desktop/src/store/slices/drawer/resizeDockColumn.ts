import { EMPTY_DRAWER_GRID, type DrawerContent } from './state';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type ResizeParams = {
  readonly kind: DrawerContent['kind'];
  readonly width: number;
};

export const resizeDockColumn = ({ set }: Params) => {
  return ({ kind, width }: ResizeParams): void => {
    set((state) => {
      const grid = state.drawerGrid ?? EMPTY_DRAWER_GRID;
      const rounded = Math.round(width);
      if (!Number.isFinite(rounded) || grid.widths[kind] === rounded) {
        return state;
      }
      return { drawerGrid: { ...grid, widths: { ...grid.widths, [kind]: rounded } } };
    });
  };
};
