import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectDrawerPanel } from '../../store/slices/drawer/selectDrawerPanel';

type Params = {
  readonly sessionId: SessionId;
};

export const openBranchBrowser = ({ sessionId }: Params): void => {
  const state = useAppStore.getState();
  const shown = selectDrawerPanel(state);
  if (shown?.kind === 'browser' && shown.sessionId === sessionId) {
    return;
  }
  state.openDrawer({ kind: 'browser', sessionId, payload: null });
};
