import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectDockDrawer } from '../../store/slices/drawer/selectDockDrawer';

type Params = {
  readonly sessionId: SessionId;
};

export const openBranchBrowser = ({ sessionId }: Params): void => {
  const state = useAppStore.getState();
  const shown = selectDockDrawer({ state });
  if (shown?.kind === 'browser' && shown.sessionId === sessionId) {
    return;
  }
  state.openDrawer({ kind: 'browser', sessionId, payload: null });
};
