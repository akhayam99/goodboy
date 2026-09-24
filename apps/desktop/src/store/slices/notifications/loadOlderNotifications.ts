import { NOTIFICATION_LIST_LIMIT, listNotifications } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { scopedWorkspaceId } from './notificationScope';
import type { GetFn, SetFn } from './types';

export const loadOlderNotifications = (set: SetFn, get: GetFn) => {
  return async () => {
    const state = get();
    const oldest = state.notifications[state.notifications.length - 1];
    if (!state.hasOlderNotifications || state.notificationsLoading || oldest == null) {
      return;
    }
    const listScope = scopedWorkspaceId({ state });
    set({ notificationsLoading: true });
    try {
      const older = await listNotifications({
        db: tauriDatabase,
        workspaceId: listScope,
        before: { ts: oldest.ts, id: oldest.id },
      });
      if (scopedWorkspaceId({ state: get() }) !== listScope) {
        set({ notificationsLoading: false });
        return;
      }
      set((current) => {
        const known = new Set(current.notifications.map((n) => n.id));
        return {
          notifications: [...current.notifications, ...older.filter((n) => !known.has(n.id))],
          hasOlderNotifications: older.length === NOTIFICATION_LIST_LIMIT,
          notificationsLoading: false,
        };
      });
    } catch (error) {
      set({ notificationsLoading: false });
      throw error;
    }
  };
};
