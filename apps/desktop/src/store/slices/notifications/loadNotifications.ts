import { countNotifications, listNotifications } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadNotifications = (set: SetFn) => {
  return async () => {
    set({ notificationsLoading: true });
    try {
      const [notifications, notificationCounts] = await Promise.all([
        listNotifications(tauriDatabase),
        countNotifications(tauriDatabase),
      ]);
      set({ notifications, notificationCounts, notificationsLoading: false });
    } catch (error) {
      set({ notificationsLoading: false });
      throw error;
    }
  };
};
