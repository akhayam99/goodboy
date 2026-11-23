import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AppState } from '../../../../store/types';
import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { openSessionTerminal } from '../../../terminal/openSessionTerminal';
import { toggleSessionTerminal } from '../../../terminal/toggleSessionTerminal';
import { scratchDirPrepare } from '../../../worktree/worktree';
import { isFaceShown } from './isFaceShown';

type SessionParams = {
  readonly sessionId: SessionId;
};

type Params = SessionParams & {
  readonly mountId: string | null;
};

type StateParams = SessionParams & {
  readonly state: AppState;
};

type MountParams = Params & {
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

const mountPathOf = ({ state, sessionId, mountId }: MountParams): string | null =>
  (state.sessionProjectMounts[sessionId] ?? []).find(
    (mount) => mount.mountId === mountId && mount.isAttached && mount.diskState === 'present',
  )?.worktreePath ?? null;

const messageOf = ({ error }: ErrorParams): string =>
  error instanceof Error ? error.message : String(error);

export const startDeskTool = async ({ sessionId, mountId }: Params): Promise<void> => {
  const state = useAppStore.getState();
  if (
    !isDeskWithoutTool({ state, sessionId }) ||
    state.deskToolStart[sessionId]?.phase === 'preparing'
  ) {
    return;
  }
  if (!isBranchlessSession({ branch: state.sessionBranches[sessionId] })) {
    const cwd = mountPathOf({ state, sessionId, mountId });
    if (cwd === null) {
      toggleSessionTerminal({ sessionId });
      return;
    }
    openSessionTerminal({ state, sessionId, cwd });
    return;
  }
  const claim = deskToolStarts.claim({ key: sessionId });
  const before = state.deskToolStart[sessionId];
  state.setDeskToolStart({
    sessionId,
    start: { phase: 'preparing', failure: before?.phase === 'failed' ? before.message : null },
  });
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
