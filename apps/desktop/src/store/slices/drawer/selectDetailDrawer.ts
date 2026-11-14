import type { AppState } from '../../types';
import { panelsOf } from './panelsOf';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'currentSessionId'> &
    Partial<Pick<AppState, 'drawerBack'>>;
};

export const selectDetailDrawer = ({ state }: Params): OpenDrawer | null => {
  const detail = panelsOf({ top: state.drawer ?? null, back: state.drawerBack ?? null }).detail;
  if (detail === null || detail.sessionId !== state.currentSessionId) {
    return null;
  }
  return detail;
};
