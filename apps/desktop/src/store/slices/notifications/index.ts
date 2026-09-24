import { clearNotifications } from './clearNotifications';
import { dismissNotification } from './dismissNotification';
import { emitNotification } from './emitNotification';
import { loadNotifications } from './loadNotifications';
import { markNotificationRead } from './markNotificationRead';
import { markNotificationsRead } from './markNotificationsRead';
import { reportError } from './reportError';
import type { GetFn, SetFn } from './types';

export const createNotificationsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadNotifications: loadNotifications(set),
    emitNotification: emitNotification(set),
    reportError: reportError(get),
    markNotificationRead: markNotificationRead(set),
    markNotificationsRead: markNotificationsRead(set),
    dismissNotification: dismissNotification(set),
    clearNotifications: clearNotifications(set),
  };
};
