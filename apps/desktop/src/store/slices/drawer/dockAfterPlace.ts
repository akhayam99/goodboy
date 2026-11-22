import type { AppState } from '../../types';
import type { Place } from '../navigation/types';
import { dockScopeOf } from './dockScopeOf';
import type { DockScope, DockScopeState } from './dockScopeState';
import { gridWithDock } from './gridWithDock';
import { isWorkspaceTool } from './isWorkspaceTool';
import { slotWithGrid } from './slotWithGrid';
import { EMPTY_DRAWER_GRID, type DrawerSliceState, type OpenDrawer } from './state';

type Params = {
  readonly state: Pick<AppState, 'drawerGrid' | 'dockScope' | 'parkedDockGrids' | 'sessions'>;
  readonly place: Place;
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
};

type KeyParams = {
  readonly scope: DockScope;
};

type DockAfterPlace = Partial<DrawerSliceState> & DockScopeState;

const OUTSIDE_KEY = '';

const parkKeyOf = ({ scope }: KeyParams): string => scope ?? OUTSIDE_KEY;

export const dockAfterPlace = ({ state, place, drawer, back }: Params): DockAfterPlace => {
  const to = dockScopeOf({ place });
  const from = state.dockScope;
  const parked = state.parkedDockGrids ?? {};
  if (from === undefined || from === to) {
    return { drawer, drawerBack: back, dockScope: to, parkedDockGrids: parked };
  }
  const leaving = state.drawerGrid ?? EMPTY_DRAWER_GRID;
  const toKey = parkKeyOf({ scope: to });
  const { [toKey]: restored = EMPTY_DRAWER_GRID, ...rest } = parked;
  const grid = [drawer, back].reduce(
    (current, entry) =>
      entry !== null && isWorkspaceTool({ content: entry })
        ? gridWithDock({ grid: current, dock: entry })
        : current,
    restored,
  );
  return {
    ...slotWithGrid({
      drawer,
      back,
      grid,
      knownSessionIds: new Set(state.sessions.map((session) => session.id)),
    }),
    dockScope: to,
    parkedDockGrids:
      leaving.columns.length === 0 ? rest : { ...rest, [parkKeyOf({ scope: from })]: leaving },
  };
};
