import type { Session, SessionAttentionReason } from '@goodboy/types';
import { useAppStore } from '../../store';
import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import { openAttentionTarget } from '../session/openAttentionTarget';

type Params = {
  readonly session: Session;
  readonly reason: SessionAttentionReason;
};

export const openAttention = ({ session, reason }: Params): void => {
  void openAttentionTarget({
    target: { workspaceId: session.workspaceId, sessionId: session.id, reason, agentId: null },
  }).catch((error: unknown) =>
    useAppStore
      .getState()
      .reportError({ recovery: CHECK_STATE, title: "Couldn't open this session", error }),
  );
};
