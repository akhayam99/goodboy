import type { SessionId } from '@goodboy/types';
import { captureLocation } from './captureLocation';
import { HOME_PLACE } from './place';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly sessionId: SessionId;
};

export const closeSession = ({ get }: SliceDeps) => {
  return ({ sessionId }: Params): void => {
    const { place } = captureLocation({ state: get() });
    if (place.at !== 'session' || place.sessionId !== sessionId) {
      return;
    }
    get().upTo({ to: HOME_PLACE });
  };
};
