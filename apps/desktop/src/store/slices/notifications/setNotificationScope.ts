import { CHECK_STATE } from './errorRecovery';
import type { NotificationScope } from './state';
import type { GetFn } from './types';
import { NAMES } from '../../../shared/utils/names';

export const setNotificationScope = (get: GetFn) => {
  return async (scope: NotificationScope) => {
    const state = get();
    const coalesceKey = `notification-scope:${scope}`;
    const isCommitted = state.notificationScope === scope && !state.notificationsLoading;
    if (!isCommitted) {
      try {
        await get().loadNotifications({ scope });
      } catch (error) {
        await get().reportError({
          title: NAMES.couldntLoadNotifications,
          error,
          coalesceKey,
          recovery: {
            action: { kind: 'retry-notification-scope', scope },
            clause: 'nothing-changed',
          },
        });
        return;
      }
    }
    if (get().notificationScope !== scope) {
      return;
    }
    await get()
      .resolveNotifications([coalesceKey])
      .catch((error: unknown) =>
        get().reportError({
          title: "Couldn't clear the notification",
          error,
          recovery: CHECK_STATE,
        }),
      );
  };
};
