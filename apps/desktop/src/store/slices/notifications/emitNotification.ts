import {
  insertNotification,
  deleteOlderNotificationsOfKey,
  type Notification,
  type NotificationAction,
  type NotificationKind,
  type NotificationSeverity,
} from '@goodboy/db';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotificationCounts } from './refreshNotificationCounts';
import { scopedWorkspaceId } from './notificationScope';
import { notificationKeyOf } from './notificationKeyOf';
import { publishTransientNotice } from './transientNotices';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';
import type { GetFn, SetFn } from './types';

const keyedWrites = createSerialQueue();
import { sessionById } from '../sessions/sessionIndex';

export type EmitNotificationParams = {
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body?: string | null;
  sessionId?: SessionId;
  workspaceId?: WorkspaceId;
  action?: NotificationAction;
  coalesceKey?: string;
  isOnce?: boolean;
  isRead?: boolean;
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
    isOnce,
    isRead = false,
  }: EmitNotificationParams) => {
    const key =
      coalesceKey ?? notificationKeyOf({ kind, severity, title, sessionId, workspaceId, action });
    if (
      isOnce === true &&
      get().notifications.some((existing) => !existing.read && existing.coalesceKey === key)
    ) {
      return;
    }
    const n: Notification = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString() as IsoDateTime,
      kind,
      title,
      body: body ?? null,
      severity,
      sessionId: sessionId ?? null,
      workspaceId: workspaceId ?? null,
      read: isRead || severity === 'success' || severity === 'info',
      action: action ?? null,
      coalesceKey: key,
      actedAt: null,
    };
    if (severity === 'success') {
      publishTransientNotice({ notification: n });
      return;
    }
    const isStored = await keyedWrites.run({
      key,
      task: async () => {
        const isInserted = await insertNotification(tauriDatabase, n).then(
          () => true,
          () => false,
        );
        if (isInserted) {
          await deleteOlderNotificationsOfKey({
            db: tauriDatabase,
            keepId: n.id,
            coalesceKey: key,
          }).then(
            () => undefined,
            () => undefined,
          );
        }
        return isInserted;
      },
    });
    if (!isStored) {
      return;
    }
    const state = get();
    const scope = scopedWorkspaceId({ state });
    const owner = workspaceId ?? sessionById(state.sessions, sessionId)?.workspaceId ?? null;
    const isInScope = scope == null || owner == null || owner === scope;
    set((current) => {
      const replaced = current.notifications.find((existing) => existing.coalesceKey === key);
      const rest = current.notifications.filter((existing) => existing !== replaced);
      return { notifications: isInScope ? [n, ...rest] : rest };
    });
    await refreshNotificationCounts({ set, get });
  };
};
