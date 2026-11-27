import { useAppStore } from '../../store';
import { selectGridTool } from '../../store/slices/drawer/selectGridTool';

type Params = {
  readonly isToggle: boolean;
};

export const toggleBrowserDock = ({ isToggle }: Params): void => {
  const state = useAppStore.getState();
  if (state.currentWorkspaceId === null || state.appStudio?.kind === 'browser') {
    return;
  }
  const shown = selectGridTool({ state, kind: 'browser' });
  if (shown !== null) {
    if (isToggle) {
      state.closeDrawerEntry({ entry: shown });
    }
    return;
  }
  const sessionId = state.appStudio === null ? state.currentSessionId : null;
  state.openDrawer(
    sessionId === null
      ? { kind: 'browser', sessionId: null, payload: null }
      : { kind: 'browser', sessionId, payload: null },
  );
};
