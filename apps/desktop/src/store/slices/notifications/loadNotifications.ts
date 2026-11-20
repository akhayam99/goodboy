import {
  NOTIFICATION_LIST_LIMIT,
  clearResolvedHelperNotifications,
  countNotifications,
  listNotifications,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { scopedWorkspaceId } from './notificationScope';
import type { NotificationScope } from './state';
import type { GetFn, SetFn } from './types';

let latestLoad = 0;

export type LoadNotificationsParams = {
  readonly scope?: NotificationScope;
};

export const loadNotifications = (set: SetFn, get: GetFn) => {
  return async ({ scope }: LoadNotificationsParams = {}) => {
    latestLoad += 1;
    const request = latestLoad;
    const workspaceId = get().currentWorkspaceId;
    const notificationScope = scope ?? get().notificationScope;
    const listScope = scopedWorkspaceId({
      state: { notificationScope, currentWorkspaceId: workspaceId },
    });
    set({ notificationsLoading: true });
    try {
      await clearResolvedHelperNotifications({ db: tauriDatabase });
      const [notifications, notificationCounts] = await Promise.all([
        listNotifications({ db: tauriDatabase, workspaceId: listScope }),
        countNotifications({ db: tauriDatabase, workspaceId }),
      ]);
      if (request !== latestLoad) {
        return;
      }
      const state = get();
      const isScopeMoved = scope === undefined && state.notificationScope !== notificationScope;
      if (state.currentWorkspaceId !== workspaceId || isScopeMoved) {
        set({ notificationsLoading: false });
        return;
      }
      set({
        notificationScope,
        notifications,
        notificationCounts,
        hasOlderNotifications: notifications.length === NOTIFICATION_LIST_LIMIT,
        notificationsLoading: false,
      });
    } catch (error) {
      if (request !== latestLoad) {
        return;
      }
      set({ notificationsLoading: false });
      throw error;
    }
  };
};
