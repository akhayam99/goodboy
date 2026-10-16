import type { SessionId } from '@goodboy/types';
import { isBranchlessSession } from '../../shared/utils/isBranchlessSession';
import { useAppStore } from '../../store';
import { resolveActiveMountPath } from '../../store/slices/worktrees/resolveActiveMountPath';
import { openSessionFolderTerminal } from './openSessionFolderTerminal';
import { openSessionTerminal } from './openSessionTerminal';
import { sessionTerminalCwd } from './sessionTerminalCwd';

type Params = {
  readonly sessionId?: SessionId;
};

export const toggleSessionTerminal = ({ sessionId: requested }: Params): void => {
  const state = useAppStore.getState();
  const sessionId = requested ?? state.currentSessionId;
  if (sessionId == null) {
    return;
  }
  if (state.drawer?.kind === 'terminal' && state.drawer.sessionId === sessionId) {
    state.closeDrawer();
    return;
  }
  if (isBranchlessSession({ branch: state.sessionBranches[sessionId] })) {
    void openSessionFolderTerminal({ sessionId }).catch((error: unknown) =>
      state.reportError({ title: "Couldn't open the terminal", error, sessionId }),
    );
    return;
  }
  const mountPaths = (state.sessionProjectMounts[sessionId] ?? [])
    .filter((mount) => mount.isAttached && mount.diskState === 'present')
    .map((mount) => mount.worktreePath);
  openSessionTerminal({
    state,
    sessionId,
    cwd: sessionTerminalCwd({
      mountPaths,
      remembered: state.terminalScopes[sessionId] ?? null,
      activePath: resolveActiveMountPath({ state, sessionId }),
    }),
  });
};
