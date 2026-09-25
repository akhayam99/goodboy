import {
  insertNotification,
  type Notification,
  type NotificationAction,
  type NotificationKind,
  type NotificationSeverity,
} from '@goodboy/db';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import { scopedWorkspaceId } from './notificationScope';
import type { GetFn, SetFn } from './types';

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

export const emitNotification = (set: SetFn, get: GetFn) => {
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
    const state = get();
    const scope = scopedWorkspaceId({ state });
    const owner =
      workspaceId ??
      state.sessions.find((session) => session.id === sessionId)?.workspaceId ??
      null;
    if (scope == null || owner == null || owner === scope) {
      set((current) => ({ notifications: [n, ...current.notifications] }));
    }
    const isStored = await insertNotification(tauriDatabase, n).then(
      () => true,
      () => false,
    );
    if (!isStored) {
      return;
    }
    await refreshNotificationCounts({ set, get });
  };
};
