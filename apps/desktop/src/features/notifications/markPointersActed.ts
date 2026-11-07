import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import type { Notification } from '@goodboy/db';
import { useAppStore } from '../../store';
import { notificationActionClass } from './actionClass';

type Params = {
  readonly notifications: ReadonlyArray<Pick<Notification, 'id' | 'action' | 'actedAt'>>;
};

export const markPointersActed = ({ notifications }: Params): void => {
  const ids = notifications
    .filter(
      (notification) =>
        notification.actedAt === null &&
        notification.action !== null &&
        notificationActionClass({ kind: notification.action.kind }) === 'pointer',
    )
    .map((notification) => notification.id);
  if (ids.length === 0) {
    return;
  }
  const store = useAppStore.getState();
  store.markNotificationsActed({ ids }).catch((error: unknown) => {
    void store.reportError({
      recovery: CHECK_STATE,
      title: "Couldn't mark the notification done",
      error,
    });
  });
};
