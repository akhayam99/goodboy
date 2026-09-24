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

export type NotificationDay = 'today' | 'yesterday' | 'earlier';

export const NOTIFICATION_DAY_LABEL = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
} satisfies Record<NotificationDay, string>;

export type NotificationDayGroup = {
  readonly day: NotificationDay;
  readonly groups: ReadonlyArray<ReadonlyArray<Notification>>;
};

type GroupByDayParams = {
  readonly groups: ReadonlyArray<ReadonlyArray<Notification>>;
  readonly now: Date;
};

export const groupByDay = ({
  groups,
  now,
}: GroupByDayParams): ReadonlyArray<NotificationDayGroup> => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const buckets: Record<NotificationDay, Array<ReadonlyArray<Notification>>> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const group of groups) {
    const ts = Date.parse(group[0]?.ts ?? '');
    const day: NotificationDay =
      ts >= startOfToday ? 'today' : ts >= startOfYesterday ? 'yesterday' : 'earlier';
    buckets[day].push(group);
  }
  return (['today', 'yesterday', 'earlier'] as const)
    .map((day) => ({ day, groups: buckets[day] }))
    .filter((entry) => entry.groups.length > 0);
};
