import { markNotificationsActed as markNotificationsActedDb } from '@goodboy/db';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly ids: ReadonlyArray<string>;
};

export const markNotificationsActed = ({ set, get }: SliceDeps) => {
  return async ({ ids }: Params) => {
    const at = brandId<IsoDateTime>({ value: new Date().toISOString() });
    await markNotificationsActedDb({ db: tauriDatabase, ids, at });
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        ids.includes(notification.id) && notification.actedAt === null
          ? { ...notification, read: true, actedAt: at }
          : notification,
      ),
    }));
    await refreshNotificationCounts({ set, get });
  };
};
