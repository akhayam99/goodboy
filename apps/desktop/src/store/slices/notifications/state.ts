import type { Notification, NotificationCountBucket } from '@goodboy/db';

export type NotificationScope = 'workspace' | 'all';

export type NotificationsState = {
  readonly notifications: ReadonlyArray<Notification>;
  readonly notificationsLoading: boolean;
  readonly notificationCounts: ReadonlyArray<NotificationCountBucket>;
  readonly notificationScope: NotificationScope;
  readonly hasOlderNotifications: boolean;
};

export const notificationsInitialState: NotificationsState = {
  notifications: [],
  notificationsLoading: false,
  notificationCounts: [],
  notificationScope: 'workspace',
  hasOlderNotifications: false,
};
