import { clearNotifications } from './clearNotifications';
import { dismissNotification } from './dismissNotification';
import { emitNotification } from './emitNotification';
import { loadNotifications } from './loadNotifications';
import { loadOlderNotifications } from './loadOlderNotifications';
import { markNotificationRead } from './markNotificationRead';
import { markNotificationsRead } from './markNotificationsRead';
import { reportError } from './reportError';
import { setNotificationScope } from './setNotificationScope';
import type { GetFn, SetFn } from './types';

export const createNotificationsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadNotifications: loadNotifications(set, get),
    loadOlderNotifications: loadOlderNotifications(set, get),
    setNotificationScope: setNotificationScope(set, get),
    emitNotification: emitNotification(set, get),
    reportError: reportError(get),
    markNotificationRead: markNotificationRead(set, get),
    markNotificationsRead: markNotificationsRead(set, get),
    dismissNotification: dismissNotification(set, get),
    clearNotifications: clearNotifications(set, get),
  };
};
