import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { openSessionTerminal } from './openSessionTerminal';
import { openSessionTerminalHere } from './openSessionTerminalHere';

type Params = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

export const openBranchTerminal = ({ sessionId, mountPath }: Params): void => {
  if (mountPath === null) {
    void openSessionTerminalHere({ sessionId, isFresh: false });
    return;
  }
  openSessionTerminal({ state: useAppStore.getState(), sessionId, cwd: mountPath });
};
