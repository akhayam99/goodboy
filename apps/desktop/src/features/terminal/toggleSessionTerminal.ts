import { isBranchlessSession } from '../../shared/utils/isBranchlessSession';
import { useAppStore } from '../../store';
import { resolveActiveMountPath } from '../../store/slices/worktrees/resolveActiveMountPath';
import { openSessionTerminal } from './openSessionTerminal';

type Params = Record<never, never>;

export const toggleSessionTerminal = ({}: Params): void => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId;
  if (sessionId == null || isBranchlessSession({ branch: state.sessionBranches[sessionId] })) {
    return;
  }
  if (state.drawer?.kind === 'terminal' && state.drawer.sessionId === sessionId) {
    state.closeDrawer();
    return;
  }
  openSessionTerminal({
    state,
    sessionId,
    cwd: resolveActiveMountPath({ state, sessionId }),
  });
};
