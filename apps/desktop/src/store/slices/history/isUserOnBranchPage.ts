import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { captureLocation } from '../navigation/captureLocation';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const isUserOnBranchPage = ({ state, sessionId }: Params): boolean => {
  const { place } = captureLocation({ state });
  return place.at === 'session' && place.sessionId === sessionId && place.view.lens === 'branch';
};
