import { clearNotifications } from './clearNotifications';
import { dismissNotification } from './dismissNotification';
import { dismissNotificationGroup } from './dismissNotificationGroup';
import { emitNotification } from './emitNotification';
import { loadNotifications } from './loadNotifications';
import { loadOlderNotifications } from './loadOlderNotifications';
import { markNotificationRead } from './markNotificationRead';
import { markNotificationUnread } from './markNotificationUnread';
import { markNotificationsActed } from './markNotificationsActed';
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
    markNotificationUnread: markNotificationUnread(set, get),
    markNotificationsActed: markNotificationsActed({ set, get }),
    markNotificationsRead: markNotificationsRead(set, get),
    dismissNotification: dismissNotification(set, get),
    dismissNotificationGroup: dismissNotificationGroup(get),
    clearNotifications: clearNotifications(set, get),
  };
};
