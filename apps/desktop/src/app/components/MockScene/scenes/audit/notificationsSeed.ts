import type { Notification } from '@goodboy/db';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { WORKSPACE_ID } from '../BoardScene';

const SESSION_ID = 'mock-notifications-session-refunds' as SessionId;

type AgoParams = {
  readonly minutesAgo: number;
};

const minutesAgo = ({ minutesAgo: minutes }: AgoParams): IsoDateTime =>
  new Date(Date.now() - minutes * 60_000).toISOString() as IsoDateTime;

type NotificationParams = Pick<Notification, 'id' | 'kind' | 'title' | 'body' | 'severity'> &
  Partial<Pick<Notification, 'read' | 'action'>> & {
    readonly minutesAgo: number;
  };

const notificationOf = ({
  id,
  kind,
  title,
  body,
  severity,
  read = false,
  action = null,
  minutesAgo: minutes,
}: NotificationParams): Notification => ({
  id,
  ts: minutesAgo({ minutesAgo: minutes }),
  sessionId: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  read,
  action,
  coalesceKey: null,
  kind,
  title,
  body,
  severity,
});

export const NOTIFICATIONS: ReadonlyArray<Notification> = [
  notificationOf({
    id: 'mock-notification-handoff',
    minutesAgo: 2,
    kind: 'summarizer-degraded',
    title: 'Handoff degraded',
    body: 'The summarizer timed out after 90s. The next step starts from the raw transcript.',
    severity: 'error',
    action: { kind: 'retry-summarizer', sessionId: SESSION_ID },
  }),
  notificationOf({
    id: 'mock-notification-budget',
    minutesAgo: 9,
    kind: 'budget-cap',
    title: 'Session reached 80% of its cap',
    body: '$8.02 of $10.00 spent on Retry failed refunds.',
    severity: 'warning',
    action: { kind: 'open-budget', sessionId: SESSION_ID },
  }),
  notificationOf({
    id: 'mock-notification-pr',
    minutesAgo: 25,
    kind: 'pr-created',
    title: 'Pull request opened',
    body: 'ledger-core #412 Retry failed refunds with backoff',
    severity: 'success',
    read: true,
  }),
  notificationOf({
    id: 'mock-notification-orphans',
    minutesAgo: 40,
    kind: 'orphan-worktrees',
    title: '1 session folder left on disk',
    body: 'notify-relay-old-spike takes 70 MB and no session claims it.',
    severity: 'info',
    action: { kind: 'open-orphan-worktrees', workspaceId: WORKSPACE_ID },
  }),
  notificationOf({
    id: 'mock-notification-retry',
    minutesAgo: 70,
    kind: 'error',
    title: 'retry failed, conversations left open',
    body: 'gh: HTTP 502 Bad Gateway (https://api.github.com/graphql)',
    severity: 'error',
  }),
  notificationOf({
    id: 'mock-notification-provider',
    minutesAgo: 120,
    kind: 'provider-connected',
    title: 'Claude connected',
    body: null,
    severity: 'success',
    read: true,
  }),
];

export const seedNotifications = (): void => {
  useAppStore.setState({
    notifications: NOTIFICATIONS,
    notificationCounts: NOTIFICATIONS.map((notification) => ({
      severity: notification.severity,
      kind: notification.kind,
      hasSession: notification.sessionId != null,
      hasAction: notification.action != null,
      read: notification.read,
      inWorkspace: true,
      count: 1,
    })),
    hasOlderNotifications: false,
    notificationsLoading: false,
    loadNotifications: async () => undefined,
    markNotificationsRead: async () => undefined,
    markNotificationRead: async () => undefined,
  });
};
