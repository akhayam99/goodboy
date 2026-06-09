import { clearNotifications } from './clearNotifications';
import { emitNotification } from './emitNotification';
import { loadNotifications } from './loadNotifications';
import { markNotificationsRead } from './markNotificationsRead';
import type { GetFn, SetFn } from './types';

export const createNotificationsSlice = (set: SetFn, _get: GetFn) => {
  return {
    loadNotifications: loadNotifications(set),
    emitNotification: emitNotification(set),
    markNotificationsRead: markNotificationsRead(set),
    clearNotifications: clearNotifications(set),
  };
};
