import type { AppState } from '../../types';
import { isWorkspaceTool } from './isWorkspaceTool';
import { panelsOf } from './panelsOf';
import { settledSlot } from './settledSlot';
import {
  EMPTY_DRAWER_GRID,
  type DrawerFocusTarget,
  type DrawerGrid,
  type DrawerSliceState,
  type OpenDrawer,
} from './state';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type TargetParams = {
  readonly target: DrawerFocusTarget;
};

type ToolParams = {
  readonly state: AppState;
  readonly grid: DrawerGrid;
  readonly entry: OpenDrawer;
  readonly dock: OpenDrawer | null;
};

type SwapParams = Pick<ToolParams, 'dock' | 'entry'> & {
  readonly slot: OpenDrawer | null;
};

const swap = ({ slot, dock, entry }: SwapParams): OpenDrawer | null =>
  slot !== null && slot === dock ? entry : slot;

const focusedTool = ({ state, grid, entry, dock }: ToolParams): DrawerSliceState =>
  settledSlot({
    drawer: swap({ slot: state.drawer ?? null, dock, entry }),
    back: swap({ slot: state.drawerBack ?? null, dock, entry }),
    grid: {
      ...grid,
      used: [...grid.used.filter((kind) => kind !== entry.kind), entry.kind],
      focus: { at: 'tool', kind: entry.kind },
    },
  });

export const focusDrawerPanel = ({ set }: Params) => {
  return ({ target }: TargetParams): void => {
    set((state) => {
      const grid = state.drawerGrid ?? EMPTY_DRAWER_GRID;
      if (target.at === 'page') {
        return grid.focus.at === 'page' ? state : { drawerGrid: { ...grid, focus: target } };
      }
      const { entry } = target;
      const panels = panelsOf({ top: state.drawer ?? null, back: state.drawerBack ?? null, grid });
      if (!isWorkspaceTool({ content: entry })) {
        return panels.detail === entry
          ? { drawerGrid: { ...grid, focus: { at: 'detail' } } }
          : state;
      }
      if (!panels.tools.some((column) => column.includes(entry))) {
        return state;
      }
      return focusedTool({ state, grid, entry, dock: panels.dock });
    });
  };
};
