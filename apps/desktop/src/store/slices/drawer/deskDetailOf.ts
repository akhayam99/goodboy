import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { panelsOf } from './panelsOf';
import { shownDeskStackOf } from './shownDeskStackOf';
import { EMPTY_DRAWER_GRID, type DrawerSliceState, type OpenDrawer } from './state';

type Params = {
  readonly state: Partial<Pick<DrawerSliceState, 'drawer' | 'drawerBack' | 'drawerGrid'>> &
    Partial<Pick<AppState, 'sessionFace'>>;
  readonly sessionId: SessionId;
};

const DESK_KINDS: ReadonlyArray<OpenDrawer['kind']> = ['transcript', 'pull-request'];

export const deskDetailOf = ({ state, sessionId }: Params): ReadonlyArray<OpenDrawer> => {
  const stack = shownDeskStackOf({ state });
  if (stack !== null) {
    return stack.agent.sessionId === sessionId ? [stack.agent, stack.pr] : [];
  }
  const detail = panelsOf({
    top: state.drawer ?? null,
    back: state.drawerBack ?? null,
    grid: state.drawerGrid ?? EMPTY_DRAWER_GRID,
  }).detail;
  return detail !== null && DESK_KINDS.includes(detail.kind) && detail.sessionId === sessionId
    ? [detail]
    : [];
};
