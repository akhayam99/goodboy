import type { Notification } from '@goodboy/db';
import { useAppStore } from '../../store';
import { openAttentionTarget } from '../session/openAttentionTarget';

type OpenNotificationSessionParams = {
  readonly notification: Notification;
};

export const openNotificationSession = ({
  notification,
}: OpenNotificationSessionParams): boolean => {
  const { sessionId, workspaceId } = notification;
  if (sessionId == null) {
    return false;
  }
  const agentId =
    notification.action?.kind === 'retry-step-summary' ? notification.action.agentId : null;
  openAttentionTarget({
    target: { workspaceId: workspaceId ?? null, sessionId, reason: null, agentId },
  }).catch((error: unknown) => {
    void useAppStore.getState().reportError({ title: "Couldn't open this notification", error });
  });
  return true;
};
