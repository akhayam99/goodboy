import { clearNotifications } from './clearNotifications';
import { dismissNotification } from './dismissNotification';
import { emitNotification } from './emitNotification';
import { loadNotifications } from './loadNotifications';
import { loadOlderNotifications } from './loadOlderNotifications';
import { markNotificationRead } from './markNotificationRead';
import { markNotificationsRead } from './markNotificationsRead';
import { reportError } from './reportError';
import { resolveNotifications } from './resolveNotifications';
import { setNotificationScope } from './setNotificationScope';
import type { SliceDeps } from '../../slice-types';

export const createNotificationsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadNotifications: loadNotifications(set, get),
    loadOlderNotifications: loadOlderNotifications(set, get),
    setNotificationScope: setNotificationScope(set, get),
    emitNotification: emitNotification(set, get),
    resolveNotifications: resolveNotifications(set, get),
    reportError: reportError(get),
    markNotificationRead: markNotificationRead(set, get),
    markNotificationsRead: markNotificationsRead(set, get),
    dismissNotification: dismissNotification(set, get),
    clearNotifications: clearNotifications(set, get),
  };
};
