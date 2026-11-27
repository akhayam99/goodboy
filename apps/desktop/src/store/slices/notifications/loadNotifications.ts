import { NOTIFICATION_LIST_LIMIT, countNotifications, listNotifications } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { writeSettledNotifications } from './settleStaleNotifications';
import { scopedWorkspaceId } from './notificationScope';
import type { NotificationScope } from './state';
import type { GetFn, SetFn } from './types';

type PendingSwitch = {
  readonly request: number;
  readonly settled: Promise<void>;
};

let latestLoad = 0;
let pendingSwitch: PendingSwitch | null = null;

export type LoadNotificationsParams = {
  readonly scope?: NotificationScope;
};

type ReadParams = {
  readonly request: number;
  readonly scope?: NotificationScope;
};

export const loadNotifications = (set: SetFn, get: GetFn) => {
  const read = async ({ request, scope }: ReadParams) => {
    const workspaceId = get().currentWorkspaceId;
    const notificationScope = scope ?? get().notificationScope;
    const listScope = scopedWorkspaceId({
      state: { notificationScope, currentWorkspaceId: workspaceId },
    });
    set({ notificationsLoading: true });
    try {
      await writeSettledNotifications();
      const [notifications, notificationCounts] = await Promise.all([
        listNotifications({ db: tauriDatabase, workspaceId: listScope }),
        countNotifications({ db: tauriDatabase, workspaceId }),
      ]);
      if (request !== latestLoad) {
        return;
      }
      const state = get();
      const isScopeMoved = scope === undefined && state.notificationScope !== notificationScope;
      if (state.currentWorkspaceId !== workspaceId || isScopeMoved) {
        set({ notificationsLoading: false });
        return;
      }
      set({
        notificationScope,
        notifications,
        notificationCounts,
        hasOlderNotifications: notifications.length === NOTIFICATION_LIST_LIMIT,
        notificationsLoading: false,
      });
    } catch (error) {
      if (request !== latestLoad) {
        return;
      }
      set({ notificationsLoading: false });
      throw error;
    }
  };
  const refresh = async (): Promise<void> => {
    const waiting = pendingSwitch;
    if (waiting !== null) {
      await Promise.allSettled([waiting.settled]);
      return refresh();
    }
    latestLoad += 1;
    return read({ request: latestLoad });
  };
  return async ({ scope }: LoadNotificationsParams = {}) => {
    if (scope === undefined) {
      return refresh();
    }
    latestLoad += 1;
    const request = latestLoad;
    const settled = read({ request, scope }).finally(() => {
      if (pendingSwitch?.request === request) {
        pendingSwitch = null;
      }
    });
    pendingSwitch = { request, settled };
    return settled;
  };
};
