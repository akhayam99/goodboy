import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import { useAppStore } from '../../store';
import { openAttentionTarget } from '../session/openAttentionTarget';
import type { SessionOpenParams } from './sources/sessionEntries';

export const openSessionAnywhere = ({ sessionId, workspaceId }: SessionOpenParams): void => {
  openAttentionTarget({
    target: { workspaceId, sessionId, reason: null, agentId: null },
  }).catch((error: unknown) => {
    void useAppStore
      .getState()
      .reportError({ recovery: CHECK_STATE, title: "Couldn't open this session", error });
  });
};
