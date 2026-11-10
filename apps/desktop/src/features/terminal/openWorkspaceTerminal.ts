import type { WorkspaceId } from '@goodboy/types';
import { homeFolder } from '../../shared/lib/homeFolder';
import { useAppStore } from '../../store';
import { selectTerminalWorkspaceFolder } from '../../store/slices/terminal/selectors';
import { openWorkspaceTerminalAt } from './openWorkspaceTerminalAt';

type OpenParams = {
  readonly workspaceId: WorkspaceId;
  readonly isFresh: boolean;
};

export const openWorkspaceTerminal = async ({
  workspaceId,
  isFresh,
}: OpenParams): Promise<void> => {
  const sessionId = useAppStore.getState().currentSessionId;
  const home = await homeFolder();
  const state = useAppStore.getState();
  if (state.currentWorkspaceId !== workspaceId || state.currentSessionId !== sessionId) {
    return;
  }
  openWorkspaceTerminalAt({
    state,
    workspaceId,
    cwd: selectTerminalWorkspaceFolder({ state, workspaceId, home }),
    isFresh,
  });
};
