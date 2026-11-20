import type { NotificationScope } from './state';
import type { GetFn } from './types';

export const setNotificationScope = (get: GetFn) => {
  return async (scope: NotificationScope) => {
    const state = get();
    if (state.notificationScope === scope && !state.notificationsLoading) {
      return;
    }
    try {
      await get().loadNotifications({ scope });
    } catch (error) {
      await get().reportError({
        title: "Couldn't load notifications",
        error,
        recovery: {
          action: { kind: 'retry-notification-scope', scope },
          clause: 'nothing-changed',
        },
      });
    }
  };
};
