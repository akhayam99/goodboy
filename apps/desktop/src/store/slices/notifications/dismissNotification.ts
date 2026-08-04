import { deleteNotification } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const dismissNotification = (set: SetFn) => {
  return async (id: string) => {
    await deleteNotification({ db: tauriDatabase, id });
    set((state) => {
      const dropped = state.notifications.find((n) => n.id === id);
      const { total, unread } = state.notificationCounts;
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        notificationCounts: {
          total: dropped != null ? Math.max(0, total - 1) : total,
          unread: dropped != null && !dropped.read ? Math.max(0, unread - 1) : unread,
        },
      };
    });
  };
};
