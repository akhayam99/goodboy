import type { AppState } from '../../types';
import { gridWithout } from './gridWithout';
import { isWorkspaceTool } from './isWorkspaceTool';
import { settledSlot } from './settledSlot';
import { EMPTY_DRAWER_GRID, type DrawerSliceState, type OpenDrawer } from './state';

type SlotState = Pick<AppState, 'drawer' | 'drawerBack'> & Partial<Pick<AppState, 'drawerGrid'>>;

type Params = {
  readonly state: SlotState;
  readonly entry: OpenDrawer;
};

type Pair = {
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
};

const pairWithout = ({ state, entry }: Params): Pair => {
  const drawer = state.drawer ?? null;
  const back = state.drawerBack ?? null;
  if (drawer === entry) {
    return { drawer: back, back: null };
  }
  if (back === entry) {
    return { drawer, back: null };
  }
  return { drawer, back };
};

export const closeSlotEntry = ({ state, entry }: Params): SlotState | DrawerSliceState => {
  const grid = state.drawerGrid ?? EMPTY_DRAWER_GRID;
  const isShown =
    state.drawer === entry ||
    state.drawerBack === entry ||
    grid.columns.some((column) => column.includes(entry));
  if (!isShown) {
    return state;
  }
  const pair = pairWithout({ state, entry });
  const kept = isWorkspaceTool({ content: entry })
    ? gridWithout({ grid, kinds: [entry.kind] })
    : grid;
  return settledSlot({ drawer: pair.drawer, back: pair.back, grid: kept });
};
