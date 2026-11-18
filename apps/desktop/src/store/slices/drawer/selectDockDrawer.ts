import type { AppState } from '../../types';
import { panelsOf } from './panelsOf';
import { EMPTY_DRAWER_GRID, type OpenDrawer } from './state';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'drawerBack' | 'appStudio'> &
    Partial<Pick<AppState, 'drawerGrid'>>;
};

export const selectDockDrawer = ({ state }: Params): OpenDrawer | null => {
  const dock = panelsOf({
    top: state.drawer ?? null,
    back: state.drawerBack ?? null,
    grid: state.drawerGrid ?? EMPTY_DRAWER_GRID,
  }).dock;
  if (dock === null || state.appStudio?.kind === dock.kind) {
    return null;
  }
  return dock;
};
