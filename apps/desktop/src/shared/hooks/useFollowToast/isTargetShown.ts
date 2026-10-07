import type { AppState } from '../../../store/types';
import { drawerKey } from '../../../store/slices/drawer/drawerKey';
import type { OpenDrawer } from '../../../store/slices/drawer/state';
import { canonicalLocation } from '../../../store/slices/navigation/canonicalLocation';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { locationKey } from '../../../store/slices/navigation/locationKey';
import type { PlaceRequest } from '../../../store/slices/navigation/types';

type Params = {
  readonly state: AppState;
  readonly request: PlaceRequest;
  readonly drawer: OpenDrawer | null;
  readonly isOverlayOpen: boolean;
};

export const isTargetShown = ({ state, request, drawer, isOverlayOpen }: Params): boolean => {
  const current = captureLocation({ state });
  if (current.studio !== null) {
    return false;
  }
  const landing = canonicalLocation({ state, request });
  if (locationKey({ place: current.place }) !== locationKey({ place: landing.place })) {
    return false;
  }
  const wanted = landing.drawer ?? drawer;
  if (wanted === null) {
    return !isOverlayOpen;
  }
  const open = state.drawer;
  return (
    open !== null && open.sessionId === wanted.sessionId && drawerKey(open) === drawerKey(wanted)
  );
};
