import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectOpenDrawer } from '../../store/slices/drawer/selectOpenDrawer';
import { browserStudioPlace } from './browserStudioPlace';

type Params = {
  readonly sessionId: SessionId;
};

export const showBrowser = ({ sessionId }: Params): void => {
  const state = useAppStore.getState();
  const studio = state.appStudio;
  if (studio !== null) {
    if (studio.kind === 'browser' && studio.sessionId === sessionId) {
      return;
    }
    state.switchStudio({ studio: browserStudioPlace({ sessionId }) });
    return;
  }
  const drawer = selectOpenDrawer(state);
  if (drawer?.kind === 'browser' && drawer.sessionId === sessionId) {
    return;
  }
  state.openDrawer({ kind: 'browser', sessionId, payload: null });
};
