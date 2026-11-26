import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { leaveStudio } from '../../../store/slices/navigation/leaveStudio';
import { openBranchTerminal } from '../../terminal/openBranchTerminal';
import { toggleBrowserDock } from '../../browser/toggleBrowserDock';
import { toggleTerminalDock } from '../../terminal/toggleTerminalDock';
import type { ClusterPane } from './clusterPane';

type Params = {
  readonly sessionId: SessionId;
  readonly pane: ClusterPane;
};

export const togglePane = ({ sessionId, pane }: Params): void => {
  switch (pane) {
    case 'terminal':
      toggleTerminalDock({ isToggle: true });
      return;
    case 'browser':
      toggleBrowserDock({ isToggle: true });
      return;
    case 'monitoring':
      useAppStore.getState().toggleDrawer({ kind: 'monitoring', sessionId: null, payload: null });
      return;
    case 'scripts': {
      if (useAppStore.getState().appStudio !== null) {
        leaveStudio({ get: useAppStore.getState });
      }
      openBranchTerminal({ sessionId, mountPath: null });
      return;
    }
    default: {
      const exhaustive: never = pane;
      return exhaustive;
    }
  }
};
