import type { Notification, NotificationAction } from '@goodboy/db';
import type { ToastAction } from '../../../../shared/components/Toast';
import type { useAppStore } from '../../../../store';
import { openNotificationSession } from '../../openNotificationSession';
import { openPlaceLabelOf } from './openPlaceLabelOf';

type Params = {
  readonly action: Extract<NotificationAction, { kind: 'open-place' }>;
  readonly store: ReturnType<typeof useAppStore.getState>;
  readonly notification: Notification;
};

export const mapOpenPlaceAction = ({ action, store, notification }: Params): ToastAction => {
  const { sessionId, reason, mountId, subject } = action;
  return {
    label: openPlaceLabelOf({ state: store, sessionId, reason, mountId, subject }),
    onClick: () => {
      openNotificationSession({ notification });
    },
  };
};
