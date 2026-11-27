import type { AppState } from '../../types';
import { sessionById } from '../sessions/sessionIndex';
import { reboundDockGrid } from './dockCarry/reboundDockGrid';
import type { Place } from '../navigation/types';
import { dockScopeOf } from './dockScopeOf';
import type { DockScopeState } from './dockScopeState';
import { slotWithGrid } from './slotWithGrid';
import { EMPTY_DRAWER_GRID, type DrawerSliceState, type OpenDrawer } from './state';

type Params = {
  readonly state: Pick<
    AppState,
    'drawerGrid' | 'dockScope' | 'sessions' | 'terminalTabs' | 'activeTerminalTab'
  >;
  readonly place: Place;
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
};

type DockAfterPlace = Partial<DrawerSliceState> & DockScopeState;

export const dockAfterPlace = ({ state, place, drawer, back }: Params): DockAfterPlace => {
  const to = dockScopeOf({ place });
  const from = state.dockScope;
  if (from === undefined || from === to) {
    return { drawer, drawerBack: back, dockScope: to };
  }
  const anchor = to ?? from;
  const workspaceId =
    anchor === null || anchor === undefined
      ? null
      : (sessionById(state.sessions, anchor)?.workspaceId ?? null);
  const grid = reboundDockGrid({
    state,
    grid: state.drawerGrid ?? EMPTY_DRAWER_GRID,
    sessionId: to,
    workspaceId,
  });
  return {
    ...slotWithGrid({
      drawer,
      back,
      grid,
      knownSessionIds: new Set([
        ...state.sessions.map((session) => session.id),
        ...(to === null ? [] : [to]),
      ]),
    }),
    dockScope: to,
  };
};
