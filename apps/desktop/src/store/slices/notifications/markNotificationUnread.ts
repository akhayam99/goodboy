import { markNotificationUnread as markNotificationUnreadDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import type { GetFn, SetFn } from './types';

export const markNotificationUnread = (set: SetFn, get: GetFn) => {
  return async (id: string) => {
    await markNotificationUnreadDb({ db: tauriDatabase, id });
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: false } : n)),
    }));
    await refreshNotificationCounts({ set, get });
  };
};
