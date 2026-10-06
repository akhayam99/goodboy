import type { AppState } from '../../types';
import type { Place } from '../navigation/types';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

export const keepAskDrawer = ({ state, place }: Params): OpenDrawer | null => {
  const drawer = state.drawer ?? null;
  if (drawer === null || drawer.kind !== 'ask') {
    return null;
  }
  return place.at === 'session' && place.sessionId === drawer.sessionId ? drawer : null;
};
