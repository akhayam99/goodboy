import { useAppStore } from '../../store';
import { selectDockDrawer } from '../../store/slices/drawer/selectDockDrawer';
import { selectSlotBack } from '../../store/slices/drawer/selectSlotBack';

type Params = {
  readonly isToggle: boolean;
};

export const toggleBrowserDock = ({ isToggle }: Params): void => {
  const state = useAppStore.getState();
  if (state.currentWorkspaceId === null || state.appStudio?.kind === 'browser') {
    return;
  }
  const shown = selectDockDrawer({ state });
  if (shown?.kind === 'browser') {
    if (isToggle) {
      state.closeDrawerEntry({ entry: shown });
    }
    return;
  }
  const back = selectSlotBack({ state });
  if (back?.kind === 'browser') {
    state.openDrawer(back);
    return;
  }
  const sessionId = state.appStudio === null ? state.currentSessionId : null;
  state.openDrawer(
    sessionId === null
      ? { kind: 'browser', sessionId: null, payload: null }
      : { kind: 'browser', sessionId, payload: null },
  );
};
