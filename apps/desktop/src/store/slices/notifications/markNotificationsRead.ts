import { markAllNotificationsRead } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import { scopedWorkspaceId } from './notificationScope';
import type { GetFn, SetFn } from './types';

export const markNotificationsRead = (set: SetFn, get: GetFn) => {
  return async () => {
    await markAllNotificationsRead({
      db: tauriDatabase,
      workspaceId: scopedWorkspaceId({ state: get() }),
    });
    set((state) => ({
      notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })),
    }));
    await refreshNotificationCounts({ set, get });
  };
};
