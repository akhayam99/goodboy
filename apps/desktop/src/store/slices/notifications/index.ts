import { clearNotifications } from './clearNotifications';
import { dismissNotification } from './dismissNotification';
import { emitNotification } from './emitNotification';
import { loadNotifications } from './loadNotifications';
import { markNotificationRead } from './markNotificationRead';
import { markNotificationsRead } from './markNotificationsRead';
import type { GetFn, SetFn } from './types';

export const createNotificationsSlice = (set: SetFn, _get: GetFn) => {
  return {
    loadNotifications: loadNotifications(set),
    emitNotification: emitNotification(set),
    markNotificationRead: markNotificationRead(set),
    markNotificationsRead: markNotificationsRead(set),
    dismissNotification: dismissNotification(set),
    clearNotifications: clearNotifications(set),
  };
};
