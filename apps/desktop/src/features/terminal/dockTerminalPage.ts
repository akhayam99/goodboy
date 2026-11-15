import type { SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../shared/types/terminal';
import { useAppStore } from '../../store';
import { selectDockDrawer } from '../../store/slices/drawer/selectDockDrawer';

type Params = {
  readonly terminalId: TerminalTabId;
  readonly sessionId: SessionId | null;
};

export const dockTerminalPage = ({ terminalId, sessionId }: Params): void => {
  useAppStore.getState().closeStudio();
  const state = useAppStore.getState();
  const shown = selectDockDrawer({ state });
  if (shown?.kind === 'terminal') {
    state.closeDrawerEntry({ entry: shown });
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
