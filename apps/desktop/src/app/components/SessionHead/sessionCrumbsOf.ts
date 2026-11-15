import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { crumbsOf, type Crumb } from '../../../store/slices/navigation/crumbsOf';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

const NO_CRUMBS: ReadonlyArray<Crumb> = [];

export const sessionCrumbsOf = ({ state, sessionId }: Params): ReadonlyArray<Crumb> => {
  const { place } = captureLocation({ state });
  if (place.at !== 'session' || place.sessionId !== sessionId) {
    return NO_CRUMBS;
  }
  return crumbsOf({ state, place });
};
