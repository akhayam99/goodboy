import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { selectDetailDrawer } from '../../../store/slices/drawer/selectDetailDrawer';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import type { ClusterPane } from './clusterPane';
import { paneOfDrawer } from './paneOfDrawer';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'currentSessionId'> &
    Partial<Pick<AppState, 'drawerBack'>>;
  readonly sessionId: SessionId;
};

export const openPaneOf = ({ state, sessionId }: Params): ClusterPane | null => {
  const drawer = selectDetailDrawer({ state }) ?? selectOpenDrawer(state);
  if (drawer === null || drawer.sessionId !== sessionId) {
    return null;
  }
  return paneOfDrawer({ drawer });
};
