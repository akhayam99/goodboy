import { turnedDockColumnsOf } from '@goodboy/ui';
import { EMPTY_DRAWER_GRID, type OpenDrawer } from './state';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type EntryParams = {
  readonly entry: OpenDrawer;
};

export const turnDockPair = ({ set }: Params) => {
  return ({ entry }: EntryParams): void => {
    set((state) => {
      const grid = state.drawerGrid ?? EMPTY_DRAWER_GRID;
      if (!grid.columns.some((column) => column.includes(entry))) {
        return state;
      }
      const turned = turnedDockColumnsOf({ columns: grid.columns });
      if (turned === null) {
        return state;
      }
      return { drawerGrid: { ...grid, columns: turned, focus: { at: 'tool', kind: entry.kind } } };
    });
  };
};
