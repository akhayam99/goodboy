import { markNotificationUnread as markNotificationUnreadDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import type { GetFn, SetFn } from './types';

export const markNotificationUnread = (set: SetFn, get: GetFn) => {
  return async (id: string) => {
    const changed = await markNotificationUnreadDb({ db: tauriDatabase, id });
    set((state) => ({
      notifications:
        changed === 0
          ? state.notifications.filter((n) => n.id !== id)
          : state.notifications.map((n) =>
              n.id === id ? { ...n, read: false, actedAt: null } : n,
            ),
    }));
    await refreshNotificationCounts({ set, get });
  };
};
