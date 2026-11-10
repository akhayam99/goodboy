import type { WorkspaceId } from '@goodboy/types';
import { homeFolder } from '../../shared/lib/homeFolder';
import { useAppStore } from '../../store';
import { selectTerminalWorkspaceFolder } from '../../store/slices/terminal/selectors';
import { workspaceTerminalOwner } from '../../store/slices/terminal/terminalOwner';
import { openTerminalOnPage } from './openTerminalOnPage';
import { openWorkspaceTerminalAt } from './openWorkspaceTerminalAt';

type OpenParams = {
  readonly workspaceId: WorkspaceId;
  readonly isFresh: boolean;
};

export const openWorkspaceTerminal = async ({
  workspaceId,
  isFresh,
}: OpenParams): Promise<void> => {
  const before = useAppStore.getState();
  const home = await homeFolder();
  const state = useAppStore.getState();
  if (
    state.currentWorkspaceId !== workspaceId ||
    state.currentSessionId !== before.currentSessionId ||
    state.drawer !== before.drawer ||
    state.appStudio !== before.appStudio
  ) {
    return;
  }
  const cwd = selectTerminalWorkspaceFolder({ state, workspaceId, home });
  if (state.appStudio?.kind === 'terminal') {
    const terminalId = state.addTerminalTab({
      owner: workspaceTerminalOwner({ workspaceId }),
      cwd,
    });
    openTerminalOnPage({ terminalId, sessionId: state.currentSessionId, isSwitch: true });
    return;
  }
  openWorkspaceTerminalAt({ state, workspaceId, cwd, isFresh });
};
