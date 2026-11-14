import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../../../../store/types';
import { backOf, type Back } from '../../../../../store/slices/navigation/backOf';
import { captureLocation } from '../../../../../store/slices/navigation/captureLocation';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const sessionBackOf = ({ state, sessionId }: Params): Back | null => {
  const { place } = captureLocation({ state });
  if (place.at !== 'session' || place.sessionId !== sessionId) {
    return null;
  }
  return backOf({ state, place });
};
