import { useAppStore } from '../../store';
import { panelFocusKeyOf } from '../../store/slices/drawer/panelFocusKeyOf';
import { selectGridTool } from '../../store/slices/drawer/selectGridTool';
import { shellPanelsOf } from '../../store/slices/drawer/shellPanelsOf';
import { focusPanelElement } from '../../shared/shellFocus/focusPanelElement';
import { focusShellPanel } from '../../shared/shellFocus/focusShellPanel';
import { openWorkspaceTerminal } from './openWorkspaceTerminal';
import { toggleSessionTerminal } from './toggleSessionTerminal';

type Params = {
  readonly isToggle: boolean;
  readonly shouldFocusFirst?: boolean;
};

const TERMINAL = 'terminal';

export const toggleTerminalDock = ({ isToggle, shouldFocusFirst = false }: Params): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null || state.appStudio?.kind === 'terminal') {
    return;
  }
  const shown = selectGridTool({ state, kind: TERMINAL });
  if (shown !== null) {
    const isFocused = panelFocusKeyOf({ panels: shellPanelsOf({ state }) }) === TERMINAL;
    if (shouldFocusFirst && !isFocused) {
      focusShellPanel({ key: TERMINAL });
      focusPanelElement({ key: TERMINAL });
      return;
    }
    if (isToggle) {
      state.closeDrawerEntry({ entry: shown });
    }
    return;
  }
  const sessionId = state.appStudio === null ? state.currentSessionId : null;
  if (sessionId !== null) {
    toggleSessionTerminal({ sessionId });
    return;
  }
  void openWorkspaceTerminal({ workspaceId, isFresh: false });
};
