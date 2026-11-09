import type { SessionId } from '@goodboy/types';
import { selectSlotBack } from '../../../store/slices/drawer/selectSlotBack';
import type { ClusterPane } from './clusterPane';
import { openPaneOf } from './openPaneOf';
import { paneOfDrawer } from './paneOfDrawer';

type Params = {
  readonly state: Parameters<typeof selectSlotBack>[0]['state'];
  readonly sessionId: SessionId;
};

export const waitingPaneOf = ({ state, sessionId }: Params): ClusterPane | null => {
  const back = selectSlotBack({ state });
  if (back === null || back.sessionId !== sessionId) {
    return null;
  }
  const pane = paneOfDrawer({ drawer: back });
  return pane === openPaneOf({ state, sessionId }) ? null : pane;
};
