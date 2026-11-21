import { dockSplitKeyOf } from '@goodboy/ui';
import { EMPTY_DRAWER_GRID, type DrawerContent } from './state';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type SplitParams = {
  readonly kinds: ReadonlyArray<DrawerContent['kind']>;
  readonly share: number | null;
};

const SHARE_STEP = 1000;

export const resizeDockRow = ({ set }: Params) => {
  return ({ kinds, share }: SplitParams): void => {
    set((state) => {
      const grid = state.drawerGrid ?? EMPTY_DRAWER_GRID;
      const isStacked = grid.columns.some(
        (column) =>
          column.length === kinds.length &&
          column.every((panel, index) => panel.kind === kinds[index]),
      );
      if (!isStacked) {
        return state;
      }
      const key = dockSplitKeyOf({ keys: kinds });
      if (share === null) {
        if (grid.splits[key] === undefined) {
          return state;
        }
        const splits = Object.fromEntries(
          Object.entries(grid.splits).filter(([known]) => known !== key),
        );
        return { drawerGrid: { ...grid, splits } };
      }
      const rounded = Math.round(share * SHARE_STEP) / SHARE_STEP;
      if (!Number.isFinite(rounded) || rounded <= 0 || rounded >= 1) {
        return state;
      }
      if (grid.splits[key] === rounded) {
        return state;
      }
      return { drawerGrid: { ...grid, splits: { ...grid.splits, [key]: rounded } } };
    });
  };
};
