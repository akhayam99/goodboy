import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectDetailDrawer } from '../../../store/slices/drawer/selectDetailDrawer';
import { selectSlotBack } from '../../../store/slices/drawer/selectSlotBack';
import { leaveStudio } from '../../../store/slices/navigation/leaveStudio';
import { openBranchTerminal } from '../../terminal/openBranchTerminal';
import { toggleBrowserDock } from '../../browser/toggleBrowserDock';
import { toggleTerminalDock } from '../../terminal/toggleTerminalDock';
import type { ClusterPane } from './clusterPane';
import { openPaneOf } from './openPaneOf';
import { waitingPaneOf } from './waitingPaneOf';

type Params = {
  readonly sessionId: SessionId;
  readonly pane: ClusterPane;
};

export const togglePane = ({ sessionId, pane }: Params): void => {
  if (pane === 'terminal') {
    toggleTerminalDock({ isToggle: true });
    return;
  }
  if (pane === 'browser') {
    toggleBrowserDock({ isToggle: true });
    return;
  }
  const isOnPage = useAppStore.getState().appStudio !== null;
  if (isOnPage) {
    leaveStudio({ get: useAppStore.getState });
  }
  const state = useAppStore.getState();
  const isShown = openPaneOf({ state, sessionId }) === pane;
  if (isShown && isOnPage) {
    return;
  }
  const detail = selectDetailDrawer({ state });
  if (isShown && detail !== null) {
    state.closeDrawerEntry({ entry: detail });
    return;
  }
  const back = selectSlotBack({ state });
  if (back !== null && waitingPaneOf({ state, sessionId }) === pane) {
    state.openDrawer(back);
    return;
  }
  switch (pane) {
    case 'scripts':
      openBranchTerminal({ sessionId, mountPath: null });
      return;
    case 'spawned':
      state.openDrawer({ kind: 'spawned', sessionId, payload: null });
      return;
    default: {
      const exhaustive: never = pane;
      return exhaustive;
    }
  }
};
