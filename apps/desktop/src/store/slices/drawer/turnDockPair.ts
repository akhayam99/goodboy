import { turnedDockColumnsOf } from '@goodboy/ui';
import { gridWithLayout } from './dockTabs/gridWithLayout';
import { layoutOf } from './dockTabs/layoutOf';
import { EMPTY_DRAWER_GRID, type OpenDrawer } from './state';
import { tabGroupsOf } from './dockTabs/tabGroupsOf';
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
      const turned = turnedDockColumnsOf({
        columns: layoutOf({ columns: grid.columns, tabs: grid.tabs }).columns,
      });
      if (turned === null) {
        return state;
      }
      const next = gridWithLayout({
        grid,
        layout: {
          columns: turned.map((column) => column.map((panel) => panel.kind)),
          groups: tabGroupsOf({ tabs: grid.tabs }),
        },
        active: null,
      });
      return { drawerGrid: { ...next, focus: { at: 'tool', kind: entry.kind } } };
    });
  };
};
