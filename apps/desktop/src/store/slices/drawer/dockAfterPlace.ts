import type { AppState } from '../../types';
import { carriedDockGrid } from './carriedDockGrid';
import { isNewSession } from './isNewSession';
import type { Place } from '../navigation/types';
import { dockScopeOf } from './dockScopeOf';
import type { DockScope, DockScopeState } from './dockScopeState';
import { gridWithDock } from './gridWithDock';
import { isWorkspaceTool } from './isWorkspaceTool';
import { slotWithGrid } from './slotWithGrid';
import { EMPTY_DRAWER_GRID, type DrawerSliceState, type OpenDrawer } from './state';

type Params = {
  readonly state: Pick<
    AppState,
    'drawerGrid' | 'dockScope' | 'parkedDockGrids' | 'lastDockGrid' | 'sessions' | 'terminalTabs'
  >;
  readonly place: Place;
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
  readonly now?: number;
};

type KeyParams = {
  readonly scope: DockScope;
};

type DockAfterPlace = Partial<DrawerSliceState> & DockScopeState;

const OUTSIDE_KEY = '';

const parkKeyOf = ({ scope }: KeyParams): string => scope ?? OUTSIDE_KEY;

export const dockAfterPlace = ({
  state,
  place,
  drawer,
  back,
  now = Date.now(),
}: Params): DockAfterPlace => {
  const to = dockScopeOf({ place });
  const from = state.dockScope;
  const parked = state.parkedDockGrids ?? {};
  const last = state.lastDockGrid ?? null;
  if (from === undefined || from === to) {
    return {
      drawer,
      drawerBack: back,
      dockScope: to,
      parkedDockGrids: parked,
      lastDockGrid: last,
    };
  }
  const leaving = state.drawerGrid ?? EMPTY_DRAWER_GRID;
  const toKey = parkKeyOf({ scope: to });
  const { [toKey]: parkedGrid, ...rest } = parked;
  const nextLast = from === null ? last : leaving;
  const inherited =
    to === null || nextLast === null || !isNewSession({ state, sessionId: to, now })
      ? EMPTY_DRAWER_GRID
      : carriedDockGrid({ state, grid: nextLast, sessionId: to });
  const restored = parkedGrid ?? inherited;
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
      from === null && leaving.columns.length === 0
        ? rest
        : { ...rest, [parkKeyOf({ scope: from })]: leaving },
    lastDockGrid: nextLast,
  };
};
