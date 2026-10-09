import { deleteNotificationsByCoalesceKey } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import type { GetFn, SetFn } from './types';

export const resolveNotifications = (set: SetFn, get: GetFn) => {
  return async (coalesceKeys: ReadonlyArray<string>) => {
    const isShown = get().notifications.some(
      (notification) =>
        notification.coalesceKey != null && coalesceKeys.includes(notification.coalesceKey),
    );
    if (!isShown) {
      return;
    }
    await deleteNotificationsByCoalesceKey({ db: tauriDatabase, coalesceKeys });
    set((state) => ({
      notifications: state.notifications.filter(
        (notification) =>
          notification.coalesceKey == null || !coalesceKeys.includes(notification.coalesceKey),
      ),
    }));
    await refreshNotificationCounts({ set, get });
  };
};
