import type { SessionId } from '@goodboy/types';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';
import type { AppStore } from '../../store/store';
import { pendingSpendEdit } from './pendingSpendEdit';
import { requestSessionSpendLimitEdit } from './requestSessionSpendLimitEdit';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

export const openSessionSpendLimitEdit = ({ state, sessionId }: Params): void => {
  if (state.currentSessionId === sessionId) {
    requestSessionSpendLimitEdit({ sessionId });
    return;
  }
  state.navigate({ to: lensPlace({ state, sessionId, lens: null }) });
  pendingSpendEdit.hold({ sessionId });
};
