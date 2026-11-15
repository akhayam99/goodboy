import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { selectDetailDrawer } from '../drawer/selectDetailDrawer';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const selectIsAskOpen = ({ state, sessionId }: Params): boolean => {
  const detail = selectDetailDrawer({ state });
  return detail?.kind === 'ask' && detail.sessionId === sessionId && state.appStudio === null;
};
