import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { openSessionShell } from './openSessionShell';

type Params = {
  readonly sessionId?: SessionId;
};

export const toggleSessionTerminal = ({ sessionId: requested }: Params): void => {
  const state = useAppStore.getState();
  const sessionId = requested ?? state.currentSessionId;
  if (sessionId == null) {
    return;
  }
  if (state.drawer?.kind === 'terminal' && state.drawer.sessionId === sessionId) {
    state.closeDrawer();
    return;
  }
  openSessionShell({ sessionId });
};
