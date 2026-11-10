import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import type { ClusterPane } from './clusterPane';
import { paneOfDrawer } from './paneOfDrawer';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'currentSessionId'>;
  readonly sessionId: SessionId;
};

export const openPaneOf = ({ state, sessionId }: Params): ClusterPane | null => {
  const drawer = selectOpenDrawer(state);
  if (drawer === null || drawer.sessionId !== sessionId) {
    return null;
  }
  return paneOfDrawer({ drawer });
};
