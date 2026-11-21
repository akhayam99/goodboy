import { markAllNotificationsRead } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import { scopedWorkspaceId } from './notificationScope';
import type { GetFn, SetFn } from './types';

export const markNotificationsRead = (set: SetFn, get: GetFn) => {
  return async () => {
    const scope = get().notificationScope;
    const workspaceId = scopedWorkspaceId({ state: get() });
    await markAllNotificationsRead({ db: tauriDatabase, workspaceId });
    if (get().notificationScope === scope && scopedWorkspaceId({ state: get() }) === workspaceId) {
      set((state) => ({
        notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })),
      }));
    }
    await refreshNotificationCounts({ set, get });
  };
};
