import {
  NOTIFICATION_LIST_LIMIT,
  insertNotification,
  type Notification,
  type NotificationAction,
  type NotificationKind,
  type NotificationSeverity,
} from '@goodboy/db';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  sessionId?: SessionId;
  workspaceId?: WorkspaceId;
  action?: NotificationAction;
  coalesceKey?: string;
};

export const emitNotification = (set: SetFn) => {
  return async (
    kind: NotificationKind,
    severity: NotificationSeverity,
    title: string,
    body?: string,
    opts?: Params,
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
      action: opts?.action ?? null,
      coalesceKey:
        opts?.coalesceKey ??
        `${kind}:${opts?.sessionId ?? opts?.workspaceId ?? 'global'}:${severity}`,
    };
    await insertNotification(tauriDatabase, n);
    set((state) => ({
      notifications: [n, ...state.notifications].slice(0, NOTIFICATION_LIST_LIMIT),
      notificationCounts: {
        total: state.notificationCounts.total + 1,
        unread: state.notificationCounts.unread + 1,
      },
    }));
  };
};
