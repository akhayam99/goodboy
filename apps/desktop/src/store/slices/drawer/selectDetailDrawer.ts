import type { AppState } from '../../types';
import { panelsOf } from './panelsOf';
import { selectOpenDrawer } from './selectOpenDrawer';
import { EMPTY_DRAWER_GRID, type OpenDrawer } from './state';

type Params = {
  readonly state: Parameters<typeof selectOpenDrawer>[0] &
    Partial<Pick<AppState, 'drawerBack' | 'drawerGrid'>>;
};

export const selectDetailDrawer = ({ state }: Params): OpenDrawer | null => {
  const detail = panelsOf({
    top: state.drawer ?? null,
    back: state.drawerBack ?? null,
    grid: state.drawerGrid ?? EMPTY_DRAWER_GRID,
  }).detail;
  return detail === null ? null : selectOpenDrawer({ ...state, drawer: detail });
};
