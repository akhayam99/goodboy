import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectDetailDrawer } from '../../../../store/slices/drawer/selectDetailDrawer';
import { toggleBrowserDock } from '../../../browser/toggleBrowserDock';
import { toggleTerminalDock } from '../../../terminal/toggleTerminalDock';
import type { RailToolId } from './sessionTools';

type Params = {
  readonly pane: RailToolId;
  readonly sessionId: SessionId | null;
};

export const toggleRailTool = ({ pane, sessionId }: Params): void => {
  const state = useAppStore.getState();
  if (pane === 'terminal') {
    toggleTerminalDock({ isToggle: true });
    return;
  }
  if (pane === 'browser') {
    toggleBrowserDock({ isToggle: true });
    return;
  }
  if (pane === 'monitoring') {
    state.toggleDrawer({ kind: 'monitoring', sessionId: null, payload: null });
    return;
  }
  if (sessionId === null) {
    return;
  }
  if (pane === 'scripts') {
    state.toggleDrawer({ kind: 'scripts', sessionId, payload: null });
    return;
  }
  const shown = selectDetailDrawer({ state });
  if (shown?.kind === 'ask' && shown.sessionId === sessionId) {
    state.closeDrawerEntry({ entry: shown });
    return;
  }
  state.openAsk({ sessionId });
};
