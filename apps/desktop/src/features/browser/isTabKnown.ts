import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { pinProjectOf } from './pinProjectOf';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly tabId: string;
};

export const isTabKnown = ({ state, sessionId, tabId }: Params): boolean => {
  if ((state.browserSessionTabs[sessionId] ?? []).some((tab) => tab.id === tabId)) {
    return true;
  }
  const projectId = pinProjectOf({ state, sessionId });
  return (
    projectId !== null &&
    (state.browserProjectPins[projectId] ?? []).some((pin) => pin.id === tabId)
  );
};
