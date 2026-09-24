import type { NotificationScope } from '../../types';
import type { GetFn, SetFn } from './types';

export const setNotificationScope = (set: SetFn, get: GetFn) => {
  return async (scope: NotificationScope) => {
    if (get().notificationScope === scope) {
      return;
    }
    set({ notificationScope: scope, notifications: [], hasOlderNotifications: false });
    await get().loadNotifications();
  };
};
