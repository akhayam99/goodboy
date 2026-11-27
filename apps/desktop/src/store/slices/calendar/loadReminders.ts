import { listReminders } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { CHECK_STATE } from '../notifications/errorRecovery';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import type { LoadRemindersParams } from './types';

export const loadReminders = ({ set, get }: SliceDeps) => {
  return async ({ workspaceId, doneSince }: LoadRemindersParams): Promise<void> => {
    const claimed = calendarWrites.loads.claim({
      key: calendarWrites.remindersKey({ workspaceId }),
    });
    try {
      const reminders = await listReminders({ db: tauriDatabase, workspaceId, doneSince });
      if (!claimed.isCurrent()) {
        return;
      }
      set((state) => ({
        calendarReminders: { ...state.calendarReminders, [workspaceId]: reminders },
      }));
    } catch (error) {
      if (!claimed.isCurrent()) {
        return;
      }
      await get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't load your reminders",
        error,
        workspaceId,
      });
    }
  };
};
