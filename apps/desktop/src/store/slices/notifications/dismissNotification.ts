import { deleteNotification } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const dismissNotification = (set: SetFn) => {
  return async (id: string) => {
    await deleteNotification({ db: tauriDatabase, id });
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  };
};
