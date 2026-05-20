import {
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  clearAllNotifications,
  type Notification,
  type NotificationKind,
  type NotificationSeverity,
} from '@goodboy/db';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

export function createNotificationsSlice(_set: SetFn, _get: GetFn) {
  const set = _set;
  return {
    loadNotifications: async () => {
      const notifications = await listNotifications(tauriDatabase);
      set({ notifications });
    },

    emitNotification: async (
      kind: NotificationKind,
      severity: NotificationSeverity,
      title: string,
      body?: string,
      opts?: { sessionId?: SessionId; workspaceId?: WorkspaceId },
    ) => {
      const n: Notification = {
        id: crypto.randomUUID(),
        ts: new Date().toISOString() as IsoDateTime,
        kind,
        title,
        body: body ?? null,
        severity,
        sessionId: opts?.sessionId ?? null,
        workspaceId: opts?.workspaceId ?? null,
        read: false,
      };
      await insertNotification(tauriDatabase, n);
      set((state) => ({ notifications: [n, ...state.notifications] }));
    },

    markNotificationsRead: async () => {
      await markAllNotificationsRead(tauriDatabase);
      set((state) => ({
        notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })),
      }));
    },

    clearNotifications: async () => {
      await clearAllNotifications(tauriDatabase);
      set({ notifications: [] });
    },
  };
}
