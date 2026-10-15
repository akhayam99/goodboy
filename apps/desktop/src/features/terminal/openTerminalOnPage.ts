import type { SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../shared/types/terminal';
import { useAppStore } from '../../store';
import {
  findTerminalTab,
  terminalWorktreeKeyIn,
} from '../../store/slices/terminal/terminalWorktree';

type OpenParams = {
  readonly terminalId: TerminalTabId;
  readonly sessionId: SessionId;
};

export const openTerminalOnPage = ({ terminalId, sessionId }: OpenParams): void => {
  const state = useAppStore.getState();
  const tab = findTerminalTab({ state, tabId: terminalId });
  const worktree = tab === null ? null : terminalWorktreeKeyIn({ state, tab });
  state.setTerminalSelection({ selection: { sessionId, worktree, terminalId } });
  state.closeDrawer();
  state.switchStudio({ studio: { kind: 'terminal', terminalId, sessionId, worktree } });
};
