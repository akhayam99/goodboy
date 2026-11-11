import type { SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../shared/types/terminal';
import { useAppStore } from '../../store';
import { selectDrawerPanel } from '../../store/slices/drawer/selectDrawerPanel';

type Params = {
  readonly terminalId: TerminalTabId;
  readonly sessionId: SessionId | null;
};

export const dockTerminalPage = ({ terminalId, sessionId }: Params): void => {
  useAppStore.getState().closeStudio();
  const state = useAppStore.getState();
  if (selectDrawerPanel(state)?.kind === 'terminal') {
    state.closeDrawer();
  }
  const payload = { terminalId };
  useAppStore
    .getState()
    .openDrawer(
      sessionId === null
        ? { kind: 'terminal', sessionId: null, payload }
        : { kind: 'terminal', sessionId, payload },
    );
};
