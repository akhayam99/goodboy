import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectDockDrawer } from '../../store/slices/drawer/selectDockDrawer';
import { browserStudioPlace } from './browserStudioPlace';

type Params = {
  readonly sessionId: SessionId;
};

export const showBrowser = ({ sessionId }: Params): void => {
  const state = useAppStore.getState();
  const studio = state.appStudio;
  if (studio?.kind === 'browser') {
    if (studio.sessionId !== sessionId) {
      state.switchStudio({ studio: browserStudioPlace({ sessionId }) });
    }
    return;
  }
  const drawer = selectDockDrawer({ state });
  if (drawer?.kind === 'browser' && drawer.sessionId === sessionId) {
    return;
  }
  state.openDrawer({ kind: 'browser', sessionId, payload: null });
};
