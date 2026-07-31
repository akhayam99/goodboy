import { listNotifications } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadNotifications = (set: SetFn) => {
  return async () => {
    set({ notificationsLoading: true });
    try {
      const notifications = await listNotifications(tauriDatabase);
      set({ notifications, notificationsLoading: false });
    } catch (error) {
      set({ notificationsLoading: false });
      throw error;
    }
  };
};
