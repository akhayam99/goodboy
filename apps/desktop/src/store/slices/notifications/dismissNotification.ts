import { deleteNotification } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import type { GetFn, SetFn } from './types';

export const dismissNotification = (set: SetFn, get: GetFn) => {
  return async (id: string) => {
    await deleteNotification({ db: tauriDatabase, id });
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
    await refreshNotificationCounts({ set, get });
  };
};
