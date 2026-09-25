import type { Notification } from '@goodboy/db';

type GroupNotificationsParams = {
  readonly notifications: ReadonlyArray<Notification>;
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

type GroupKeyParams = {
  readonly group: ReadonlyArray<Notification>;
};

export const notificationGroupKey = ({ group }: GroupKeyParams): string =>
  group[0]?.coalesceKey ?? group[0]?.id ?? '';
