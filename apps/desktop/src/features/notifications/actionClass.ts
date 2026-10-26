import type { Notification, NotificationAction } from '@goodboy/db';

export type NotificationActionClass = 'debt' | 'pointer';

type KindParams = {
  readonly kind: NotificationAction['kind'];
};

export const notificationActionClass = ({ kind }: KindParams): NotificationActionClass => {
  switch (kind) {
    case 'retry-summarizer':
    case 'retry-orchestrator':
    case 'retry-step-summary':
    case 'retry-publication':
    case 'retry-update':
    case 'retry-push':
    case 'update-provider-cli':
      return 'debt';
    case 'open-agent':
    case 'open-budget':
    case 'open-orphan-worktrees':
    case 'open-storage':
    case 'open-lens':
    case 'open-activity':
    case 'open-settings':
    case 'reveal-path':
      return 'pointer';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

type NotificationParams = {
  readonly notification: Pick<Notification, 'action'>;
};

export const isNotificationDebt = ({ notification }: NotificationParams): boolean =>
  notification.action !== null &&
  notificationActionClass({ kind: notification.action.kind }) === 'debt';
