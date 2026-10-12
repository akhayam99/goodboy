import type { WorkspaceId } from '@goodboy/types';
import { homeFolder } from '../../shared/lib/homeFolder';
import { useAppStore } from '../../store';
import { selectTerminalWorkspaceFolder } from '../../store/slices/terminal/selectors';
import { workspaceTerminalOwner } from '../../store/slices/terminal/terminalOwner';
import { openTerminalAt } from './openTerminalAt';

type OpenParams = {
  readonly workspaceId: WorkspaceId;
};

export const openWorkspaceTerminal = async ({ workspaceId }: OpenParams): Promise<void> => {
  const sessionId = useAppStore.getState().currentSessionId;
  const home = await homeFolder();
  const state = useAppStore.getState();
  if (state.currentWorkspaceId !== workspaceId || state.currentSessionId !== sessionId) {
    return;
  }
  openTerminalAt({
    state,
    owner: workspaceTerminalOwner({ workspaceId }),
    cwd: selectTerminalWorkspaceFolder({ state, workspaceId, home }),
    sessionId,
  });
};
