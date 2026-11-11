import { useAppStore } from '../../store';
import { selectDrawerPanel } from '../../store/slices/drawer/selectDrawerPanel';
import { selectSlotBack } from '../../store/slices/drawer/selectSlotBack';
import { openWorkspaceTerminal } from './openWorkspaceTerminal';
import { toggleSessionTerminal } from './toggleSessionTerminal';

type Params = {
  readonly isToggle: boolean;
};

export const toggleTerminalDock = ({ isToggle }: Params): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null || state.appStudio?.kind === 'terminal') {
    return;
  }
  const shown = selectDrawerPanel(state);
  if (shown?.kind === 'terminal') {
    if (isToggle) {
      state.closeDrawer();
    }
    return;
  }
  const back = selectSlotBack({ state });
  if (back?.kind === 'terminal') {
    state.openDrawer(back);
    return;
  }
  const sessionId = state.appStudio === null ? state.currentSessionId : null;
  if (sessionId !== null) {
    toggleSessionTerminal({ sessionId });
    return;
  }
  void openWorkspaceTerminal({ workspaceId, isFresh: false });
};
