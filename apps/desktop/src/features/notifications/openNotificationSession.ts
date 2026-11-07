import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import type { Notification } from '@goodboy/db';
import { useAppStore } from '../../store';
import type { AttentionTarget } from '../session/attentionTarget';
import { openAttentionTarget } from '../session/openAttentionTarget';

type OpenNotificationSessionParams = {
  readonly notification: Notification;
};

const exactPlaceOf = ({
  notification,
}: OpenNotificationSessionParams): Pick<AttentionTarget, 'place'> => {
  const { action } = notification;
  if (action?.kind !== 'open-place') {
    return {};
  }
  const { reason, mountId, subject } = action;
  return { place: { reason, mountId, ...(subject === undefined ? {} : { subject }) } };
};

export const openNotificationSession = ({
  notification,
}: OpenNotificationSessionParams): boolean => {
  const { sessionId, workspaceId, action } = notification;
  if (sessionId == null) {
    return false;
  }
  const agentId = action?.kind === 'retry-step-summary' ? action.agentId : null;
  openAttentionTarget({
    target: {
      workspaceId: workspaceId ?? null,
      sessionId,
      reason: null,
      agentId,
      ...exactPlaceOf({ notification }),
    },
  }).catch((error: unknown) => {
    void useAppStore
      .getState()
      .reportError({ recovery: CHECK_STATE, title: "Couldn't open this notification", error });
  });
  return true;
};
