import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectSlotBack } from '../../../store/slices/drawer/selectSlotBack';
import { openExplorePane } from '../../explore/openExplorePane';
import { openScriptsPane } from '../../scripts/openScriptsPane';
import { toggleSessionTerminal } from '../../terminal/toggleSessionTerminal';
import type { ClusterPane } from './clusterPane';
import { openPaneOf } from './openPaneOf';
import { waitingPaneOf } from './waitingPaneOf';

type Params = {
  readonly sessionId: SessionId;
  readonly pane: ClusterPane;
};

export const togglePane = ({ sessionId, pane }: Params): void => {
  const state = useAppStore.getState();
  if (openPaneOf({ state, sessionId }) === pane) {
    state.closeDrawer();
    return;
  }
  const back = selectSlotBack({ state });
  if (back !== null && waitingPaneOf({ state, sessionId }) === pane) {
    state.openDrawer(back);
    return;
  }
  switch (pane) {
    case 'ask':
      state.openAsk({ sessionId });
      return;
    case 'terminal':
      toggleSessionTerminal({ sessionId });
      return;
    case 'explore':
      openExplorePane({ state, sessionId, mountPath: null });
      return;
    case 'context':
      state.openContextDrawer({
        sessionId,
        section: 'goal',
      });
      return;
    case 'scripts':
      openScriptsPane({ state, sessionId, projectId: null });
      return;
    case 'spawned':
      state.openDrawer({ kind: 'spawned', sessionId, payload: null });
      return;
    case 'browser':
      state.openDrawer({ kind: 'browser', sessionId, payload: null });
      return;
    default: {
      const exhaustive: never = pane;
      return exhaustive;
    }
  }
};
