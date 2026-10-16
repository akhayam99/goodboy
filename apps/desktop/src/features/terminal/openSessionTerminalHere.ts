import type { SessionId } from '@goodboy/types';
import { homeFolder } from '../../shared/lib/homeFolder';
import { useAppStore } from '../../store';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { selectTerminalWorkspaceFolder } from '../../store/slices/terminal/selectors';
import { resolveActiveMountPath } from '../../store/slices/worktrees/resolveActiveMountPath';
import { openSessionTerminal } from './openSessionTerminal';

type OpenHereParams = {
  readonly sessionId: SessionId;
  readonly isFresh: boolean;
};

export const openSessionTerminalHere = async ({
  sessionId,
  isFresh,
}: OpenHereParams): Promise<void> => {
  const mountPath = resolveActiveMountPath({ state: useAppStore.getState(), sessionId });
  if (mountPath !== null) {
    openSessionTerminal({ state: useAppStore.getState(), sessionId, cwd: mountPath, isFresh });
    return;
  }
  const home = await homeFolder();
  const state = useAppStore.getState();
  if (state.currentSessionId !== sessionId) {
    return;
  }
  const session = sessionById(state.sessions, sessionId);
  const cwd =
    session === undefined
      ? null
      : selectTerminalWorkspaceFolder({ state, workspaceId: session.workspaceId, home });
  openSessionTerminal({ state, sessionId, cwd, isFresh });
};
