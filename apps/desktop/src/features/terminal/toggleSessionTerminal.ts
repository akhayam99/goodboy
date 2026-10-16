import { useAppStore } from '../../store';
import { openSessionTerminalHere } from './openSessionTerminalHere';

type Params = Record<never, never>;

export const toggleSessionTerminal = ({}: Params): void => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId;
  if (sessionId == null) {
    return;
  }
  if (state.drawer?.kind === 'terminal' && state.drawer.sessionId === sessionId) {
    state.closeDrawer();
    return;
  }
  void openSessionTerminalHere({ sessionId, isFresh: false });
};
