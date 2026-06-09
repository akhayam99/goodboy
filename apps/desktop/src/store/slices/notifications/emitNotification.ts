import {
  insertNotification,
  type Notification,
  type NotificationKind,
  type NotificationSeverity,
} from '@goodboy/db';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  sessionId?: SessionId;
  workspaceId?: WorkspaceId;
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
    };
    await insertNotification(tauriDatabase, n);
    set((state) => ({ notifications: [n, ...state.notifications] }));
  };
};
