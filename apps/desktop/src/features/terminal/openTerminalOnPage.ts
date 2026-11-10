import type { SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../shared/types/terminal';
import { useAppStore } from '../../store';
import {
  findTerminalTab,
  terminalWorktreeKeyIn,
} from '../../store/slices/terminal/terminalWorktree';

type OpenParams = {
  readonly terminalId: TerminalTabId;
  readonly sessionId: SessionId | null;
  readonly isSwitch?: boolean;
};

export const openTerminalOnPage = ({
  terminalId,
  sessionId,
  isSwitch = false,
}: OpenParams): void => {
  const state = useAppStore.getState();
  const tab = findTerminalTab({ state, tabId: terminalId });
  const worktree = tab === null ? null : terminalWorktreeKeyIn({ state, tab });
  state.setTerminalSelection({ selection: { sessionId, worktree, terminalId } });
  if (isSwitch) {
    state.switchStudio({ studio: { kind: 'terminal', terminalId, sessionId, worktree } });
    return;
  }
  state.openStudio({ studio: { kind: 'terminal', terminalId, sessionId, worktree } });
};
