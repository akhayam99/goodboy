import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectDrawerPanel } from '../../store/slices/drawer/selectDrawerPanel';
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
  const drawer = selectDrawerPanel(state);
  if (drawer?.kind === 'browser' && drawer.sessionId === sessionId) {
    return;
  }
  state.openDrawer({ kind: 'browser', sessionId, payload: null });
};
