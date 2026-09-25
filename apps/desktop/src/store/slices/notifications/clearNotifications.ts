import { clearAllNotifications } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import { scopedWorkspaceId } from './notificationScope';
import type { GetFn, SetFn } from './types';

export const clearNotifications = (set: SetFn, get: GetFn) => {
  return async () => {
    await clearAllNotifications({
      db: tauriDatabase,
      workspaceId: scopedWorkspaceId({ state: get() }),
    });
    set({ notifications: [], hasOlderNotifications: false });
    await refreshNotificationCounts({ set, get });
  };
};
