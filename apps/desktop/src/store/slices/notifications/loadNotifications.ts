import { NOTIFICATION_LIST_LIMIT, countNotifications, listNotifications } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { scopedWorkspaceId } from './notificationScope';
import type { GetFn, SetFn } from './types';

let latestLoad = 0;

export const loadNotifications = (set: SetFn, get: GetFn) => {
  return async () => {
    latestLoad += 1;
    const request = latestLoad;
    const workspaceId = get().currentWorkspaceId;
    const listScope = scopedWorkspaceId({ state: get() });
    set({ notificationsLoading: true });
    try {
      const [notifications, notificationCounts] = await Promise.all([
        listNotifications({ db: tauriDatabase, workspaceId: listScope }),
        countNotifications({ db: tauriDatabase, workspaceId }),
      ]);
      if (request !== latestLoad) {
        return;
      }
      const state = get();
      if (state.currentWorkspaceId !== workspaceId || scopedWorkspaceId({ state }) !== listScope) {
        set({ notificationsLoading: false });
        return;
      }
      set({
        notifications,
        notificationCounts,
        hasOlderNotifications: notifications.length === NOTIFICATION_LIST_LIMIT,
        notificationsLoading: false,
      });
    } catch (error) {
      if (request === latestLoad) {
        set({ notificationsLoading: false });
      }
      throw error;
    }
  };
};
