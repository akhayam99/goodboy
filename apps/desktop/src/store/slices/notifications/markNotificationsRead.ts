import { markAllNotificationsRead } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const markNotificationsRead = (set: SetFn) => {
  return async () => {
    await markAllNotificationsRead(tauriDatabase);
    set((state) => ({
      notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })),
    }));
  };
};
