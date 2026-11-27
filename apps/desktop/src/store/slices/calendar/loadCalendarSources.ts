import { listCalendarRoles, listCalendarSources } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { CHECK_STATE } from '../notifications/errorRecovery';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';

export const loadCalendarSources = ({ set, get }: SliceDeps) => {
  return async (): Promise<void> => {
    const claimed = calendarWrites.loads.claim({ key: calendarWrites.sourcesKey });
    try {
      const [sources, roles] = await Promise.all([
        listCalendarSources({ db: tauriDatabase }),
        listCalendarRoles({ db: tauriDatabase }),
      ]);
      if (!claimed.isCurrent()) {
        return;
      }
      set({ calendarSources: sources, calendarRoles: roles });
    } catch (error) {
      if (!claimed.isCurrent()) {
        return;
      }
      await get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't load your calendars",
        error,
      });
    }
  };
};
