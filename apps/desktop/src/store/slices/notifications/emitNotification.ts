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

export type EmitNotificationParams = {
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body?: string | null;
  sessionId?: SessionId;
  workspaceId?: WorkspaceId;
  action?: NotificationAction;
  coalesceKey?: string;
};

export const emitNotification = (set: SetFn) => {
  return async ({
    kind,
    severity,
    title,
    body,
    sessionId,
    workspaceId,
    action,
    coalesceKey,
  }: EmitNotificationParams) => {
    const n: Notification = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString() as IsoDateTime,
      kind,
      title,
      body: body ?? null,
      severity,
      sessionId: sessionId ?? null,
      workspaceId: workspaceId ?? null,
      read: false,
      action: action ?? null,
      coalesceKey:
        coalesceKey ?? `${kind}:${sessionId ?? workspaceId ?? 'global'}:${severity}:${title}`,
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
