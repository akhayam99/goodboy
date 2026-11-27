import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { captureLocation } from '../../store/slices/navigation/captureLocation';
import { foldedLensOf } from '../../store/slices/navigation/foldedLensOf';
import { isTabView } from '../../store/slices/navigation/isTabView';
import { resolveLensSurface } from './lens-surface';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const isOverviewShown = ({ state, sessionId }: Params): boolean => {
  const { place, studio } = captureLocation({ state });
  return (
    studio === null &&
    place.at === 'session' &&
    place.sessionId === sessionId &&
    isTabView({ view: place.view }) &&
    resolveLensSurface({ lens: foldedLensOf({ lens: place.view.lens }) }) === 'overview'
  );
};
