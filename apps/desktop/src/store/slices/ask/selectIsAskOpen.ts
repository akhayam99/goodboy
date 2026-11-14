import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { selectOpenDrawer } from '../drawer/selectOpenDrawer';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const selectIsAskOpen = ({ state, sessionId }: Params): boolean => {
  const drawer = selectOpenDrawer(state);
  return drawer?.kind === 'ask' && drawer.sessionId === sessionId && state.appStudio === null;
};
