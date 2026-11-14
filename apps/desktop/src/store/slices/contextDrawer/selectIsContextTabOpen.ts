import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { currentStack } from '../navigation/currentStack';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const selectIsContextTabOpen = ({ state, sessionId }: Params): boolean => {
  const stack = currentStack(state);
  const place = stack.entries[stack.index]?.place;
  return (
    place !== undefined &&
    place.at === 'session' &&
    place.sessionId === sessionId &&
    place.view.lens === 'context' &&
    state.appStudio === null
  );
};
