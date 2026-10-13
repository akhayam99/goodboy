import type { SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../shared/types/terminal';
import { useAppStore } from '../../store';

type OpenParams = {
  readonly terminalId: TerminalTabId;
  readonly sessionId: SessionId;
};

export const openTerminalOnPage = ({ terminalId, sessionId }: OpenParams): void => {
  const state = useAppStore.getState();
  state.closeDrawer();
  state.switchStudio({ studio: { kind: 'terminal', terminalId, sessionId } });
};
