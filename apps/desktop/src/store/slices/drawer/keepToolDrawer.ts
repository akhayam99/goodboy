import type { AppState } from '../../types';
import type { Place } from '../navigation/types';
import { DRAWER_KINDS } from './drawerKinds';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

export const keepToolDrawer = ({ state, place }: Params): OpenDrawer | null => {
  const drawer = state.drawer ?? null;
  if (drawer === null || place.at !== 'session' || place.sessionId !== drawer.sessionId) {
    return null;
  }
  const row = DRAWER_KINDS[drawer.kind];
  if (row.surface !== 'tool' || row.pane === null) {
    return null;
  }
  return drawer.kind === 'spawned' ? { ...drawer, payload: null } : drawer;
};
