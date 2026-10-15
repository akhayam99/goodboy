import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import type { TerminalOwner } from '../../shared/types/terminal';
import { useAppStore } from '../../store';
import {
  findTerminalTab,
  terminalWorktreeKeyIn,
} from '../../store/slices/terminal/terminalWorktree';

type OpenParams = {
  readonly state: Pick<AppStore, 'addTerminalTab' | 'switchStudio' | 'setTerminalSelection'>;
  readonly owner: TerminalOwner;
  readonly cwd: string | null;
  readonly sessionId: SessionId | null;
};

export const openTerminalAt = ({ state, owner, cwd, sessionId }: OpenParams): void => {
  const terminalId = state.addTerminalTab({ owner, cwd });
  const fresh = useAppStore.getState();
  const tab = findTerminalTab({ state: fresh, tabId: terminalId });
  const worktree = tab === null ? null : terminalWorktreeKeyIn({ state: fresh, tab });
  state.setTerminalSelection({ selection: { sessionId, worktree, terminalId } });
  state.switchStudio({ studio: { kind: 'terminal', terminalId, sessionId, worktree } });
};
