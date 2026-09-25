import { markNotificationRead as markNotificationReadDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import type { GetFn, SetFn } from './types';

export const markNotificationRead = (set: SetFn, get: GetFn) => {
  return async (id: string) => {
    await markNotificationReadDb({ db: tauriDatabase, id });
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    await refreshNotificationCounts({ set, get });
  };
};
