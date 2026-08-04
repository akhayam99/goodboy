import { markNotificationRead as markNotificationReadDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const markNotificationRead = (set: SetFn) => {
  return async (id: string) => {
    await markNotificationReadDb({ db: tauriDatabase, id });
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  };
};
