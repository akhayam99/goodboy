import { useEffect, useRef } from 'react';
import type { Notification } from '@goodboy/db';
import { inlineMarkdownText } from '@goodboy/ui';
import type { Session, Workspace } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { markPointersActed } from '../../markPointersActed';
import { mapNotificationAction } from './mapNotificationAction';
import { staleToastIdsOf } from './staleToastIdsOf';
import { subscribeTransientNotices } from '../../../../store/slices/notifications/transientNotices';

export const pickFreshFailures = (
  notifications: ReadonlyArray<Notification>,
  seen: Set<string>,
  since: number,
): ReadonlyArray<Notification> => {
  const out: Array<Notification> = [];
  for (const n of notifications) {
    if (seen.has(n.id)) {
      continue;
    }
    seen.add(n.id);
    if (new Date(n.ts).getTime() < since) {
      continue;
    }
    if (n.read || (n.severity !== 'error' && n.severity !== 'warning')) {
      continue;
    }
    out.push(n);
  }
  return out;
};

export const notificationContext = (
  n: Notification,
  sessions: ReadonlyArray<Session>,
  workspaces: ReadonlyArray<Workspace>,
): string | undefined => {
  const parts: Array<string> = [];
  const ws = n.workspaceId ? workspaces.find((w) => w.id === n.workspaceId) : undefined;
  if (ws) {
    parts.push(ws.name);
  }
  const session = n.sessionId ? sessionById(sessions, n.sessionId) : undefined;
  if (session) {
    parts.push(inlineMarkdownText({ text: sessionTitle({ session }) }).trim());
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
};

export const NotificationToastBridge = () => {
  const notifications = useAppStore((s) => s.notifications);
  const sessions = useAppStore((s) => s.sessions);
  const workspaces = useAppStore((s) => s.workspaces);
  const { previewNotification, showToast, removeNotificationIds } = useToast();

  const seen = useRef<Set<string>>(new Set());
  const shown = useRef<Set<string>>(new Set());
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    return subscribeTransientNotices({
      listener: ({ notification }) => {
        const store = useAppStore.getState();
        const toastAction = mapNotificationAction({ store, notification });
        showToast({
          kind: 'success',
          title: notification.title,
          message: notification.body ?? '',
          context: notificationContext(notification, store.sessions, store.workspaces),
          dedupeKey: notification.coalesceKey ?? undefined,
          action: toastAction,
        });
      },
    });
  }, [showToast]);

  useEffect(() => {
    const stale = staleToastIdsOf({ shownIds: shown.current, notifications });
    if (stale.size > 0) {
      stale.forEach((id) => shown.current.delete(id));
      removeNotificationIds({ ids: stale });
    }
    for (const n of pickFreshFailures(notifications, seen.current, mountedAt.current)) {
      const store = useAppStore.getState();
      const toastAction = mapNotificationAction({ store, notification: n });
      shown.current.add(n.id);
      previewNotification({
        severity: n.severity === 'error' ? 'error' : 'warning',
        title: n.title,
        message: n.body ?? '',
        context: notificationContext(n, sessions, workspaces),
        persist: n.severity === 'error',
        dedupeKey: n.coalesceKey ?? undefined,
        notificationIds: [n.id],
        onDismiss: () => {
          shown.current.delete(n.id);
        },
        action:
          toastAction === undefined
            ? undefined
            : {
                ...toastAction,
                onClick: () => {
                  toastAction.onClick();
                  markPointersActed({ notifications: [n] });
                },
              },
      });
    }
  }, [notifications, sessions, workspaces, previewNotification, removeNotificationIds]);

  return null;
};
