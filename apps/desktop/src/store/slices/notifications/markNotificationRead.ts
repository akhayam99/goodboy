import { markNotificationRead as markNotificationReadDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const markNotificationRead = (set: SetFn) => {
  return async (id: string) => {
    await markNotificationReadDb({ db: tauriDatabase, id });
    set((state) => {
      const wasUnread = state.notifications.some((n) => n.id === id && !n.read);
      const { total, unread } = state.notificationCounts;
      return {
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        notificationCounts: { total, unread: wasUnread ? Math.max(0, unread - 1) : unread },
      };
    });
  };
};
