import type { Notification } from '@goodboy/db';

export type NotificationSeverityFilter = 'all' | 'error' | 'warning' | 'info';

type GroupNotificationsParams = {
  readonly notifications: ReadonlyArray<Notification>;
};

type FilterNotificationGroupsParams = {
  readonly groups: ReadonlyArray<ReadonlyArray<Notification>>;
  readonly severity: NotificationSeverityFilter;
  readonly isUnreadOnly: boolean;
};

export const groupNotifications = ({ notifications }: GroupNotificationsParams) => {
  const groups = new Map<string, Array<Notification>>();
  for (const notification of notifications) {
    const key = notification.coalesceKey ?? notification.id;
    const group = groups.get(key) ?? [];
    group.push(notification);
    groups.set(key, group);
  }
  return [...groups.values()];
};

export const sortNotificationGroupsNewestFirst = ({ notifications }: GroupNotificationsParams) =>
  groupNotifications({ notifications })
    .map((group) => [...group].sort((left, right) => Date.parse(right.ts) - Date.parse(left.ts)))
    .sort((left, right) => Date.parse(right[0]?.ts ?? '') - Date.parse(left[0]?.ts ?? ''));

export const filterNotificationGroups = ({
  groups,
  severity,
  isUnreadOnly,
}: FilterNotificationGroupsParams) =>
  groups.filter((group) => {
    const hasMatchingSeverity = group.some((notification) => {
      if (severity === 'all') {
        return true;
      }
      if (severity === 'info') {
        return notification.severity === 'info' || notification.severity === 'success';
      }
      return notification.severity === severity;
    });
    const hasUnread = group.some((notification) => notification.read === false);
    return hasMatchingSeverity && (isUnreadOnly === false || hasUnread);
  });
