import type { Place } from '../navigation/types';
import { DRAWER_KINDS } from './drawerKinds';
import type { OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null;
  readonly place: Place;
};

export const keptTool = ({ drawer, place }: Params): OpenDrawer | null => {
  if (drawer === null || place.at !== 'session' || place.sessionId !== drawer.sessionId) {
    return null;
  }
  const row = DRAWER_KINDS[drawer.kind];
  if (row.surface !== 'tool' || row.pane === null) {
    return null;
  }
  return drawer.kind === 'spawned' ? { ...drawer, payload: null } : drawer;
};
