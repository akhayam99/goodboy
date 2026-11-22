import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AppState } from '../../../../store/types';
import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { openSessionTerminal } from '../../../terminal/openSessionTerminal';
import { toggleTerminalDock } from '../../../terminal/toggleTerminalDock';
import { scratchDirPrepare } from '../../../worktree/worktree';
import { isFaceShown } from './isFaceShown';

type Params = {
  readonly sessionId: SessionId;
};

type StateParams = Params & {
  readonly state: AppState;
};

type ErrorParams = {
  readonly error: unknown;
};

const deskToolStarts = createLatestOnly();

const isDeskWithoutTool = ({ state, sessionId }: StateParams): boolean =>
  state.currentSessionId === sessionId &&
  (state.sessionFace[sessionId] ?? 'overview') === 'desk' &&
  isFaceShown({ state, sessionId }) &&
  state.drawerGrid.columns.length === 0;

const messageOf = ({ error }: ErrorParams): string =>
  error instanceof Error ? error.message : String(error);

export const startDeskTool = async ({ sessionId }: Params): Promise<void> => {
  const state = useAppStore.getState();
  if (
    !isDeskWithoutTool({ state, sessionId }) ||
    state.deskToolStart[sessionId]?.phase === 'preparing'
  ) {
    return;
  }
  if (!isBranchlessSession({ branch: state.sessionBranches[sessionId] })) {
    toggleTerminalDock({ isToggle: false });
    return;
  }
  const claim = deskToolStarts.claim({ key: sessionId });
  state.setDeskToolStart({ sessionId, start: { phase: 'preparing' } });
  try {
    const cwd = await scratchDirPrepare({ sessionId });
    if (!claim.isCurrent()) {
      return;
    }
    const after = useAppStore.getState();
    after.setDeskToolStart({ sessionId, start: null });
    if (isDeskWithoutTool({ state: after, sessionId })) {
      openSessionTerminal({ state: after, sessionId, cwd });
    }
  } catch (error) {
    if (claim.isCurrent()) {
      useAppStore.getState().setDeskToolStart({
        sessionId,
        start: { phase: 'failed', message: messageOf({ error }) },
      });
    }
  }
};
