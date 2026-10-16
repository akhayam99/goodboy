import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { scratchDirPrepare } from '../worktree/worktree';
import { openSessionTerminal } from './openSessionTerminal';

type Params = {
  readonly sessionId: SessionId;
};

export const openSessionFolderTerminal = async ({ sessionId }: Params): Promise<void> => {
  const cwd = await scratchDirPrepare({ sessionId });
  const state = useAppStore.getState();
  if (state.currentSessionId !== sessionId) {
    return;
  }
  openSessionTerminal({ state, sessionId, cwd });
};
