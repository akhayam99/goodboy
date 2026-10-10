import { deleteNotification, type Notification } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import type { GetFn, SetFn } from './types';

export const dismissNotification = (set: SetFn, get: GetFn) => {
  return async (id: string): Promise<Notification | undefined> => {
    const removed = get().notifications.find((notification) => notification.id === id);
    await deleteNotification({ db: tauriDatabase, id });
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
    await refreshNotificationCounts({ set, get });
    return removed;
  };
};
