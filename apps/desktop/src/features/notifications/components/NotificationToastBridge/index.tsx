import { useEffect, useRef } from 'react';
import type { Notification } from '@goodboy/db';
import type { Session, Workspace } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

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
    if (n.severity !== 'error' && n.severity !== 'warning') {
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
  const session = n.sessionId ? sessions.find((s) => s.id === n.sessionId) : undefined;
  if (session) {
    parts.push(session.goal.trim() || 'untitled session');
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
};

export const NotificationToastBridge = () => {
  const notifications = useAppStore((s) => s.notifications);
  const sessions = useAppStore((s) => s.sessions);
  const workspaces = useAppStore((s) => s.workspaces);
  const { showToast } = useToast();

  const seen = useRef<Set<string>>(new Set());
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    for (const n of pickFreshFailures(notifications, seen.current, mountedAt.current)) {
      showToast(n.severity === 'error' ? 'error' : 'warning', n.body ?? '', {
        title: n.title,
        context: notificationContext(n, sessions, workspaces),
        persist: n.severity === 'error',
      });
    }
  }, [notifications, sessions, workspaces, showToast]);

  return null;
};
