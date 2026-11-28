import { formatError } from '@goodboy/ui';
import type { CalendarEvent, CalendarList } from '@goodboy/types';
import { CHECK_STATE } from '../notifications/errorRecovery';
import type { SliceDeps } from '../../slice-types';
import { calendarWrites } from './calendarWrites';
import { eventsWithRoles } from './eventsWithRoles';
import type { LoadCalendarEventsParams } from './types';

const NOTHING_LISTED: CalendarList<CalendarEvent> = { items: [], failedSources: [] };

export const loadCalendarEvents = ({ set, get }: SliceDeps) => {
  return async ({ range, listEvents }: LoadCalendarEventsParams): Promise<void> => {
    const claimed = calendarWrites.loads.claim({ key: calendarWrites.dayKey });
    const sources = get().calendarSources.map((source) => ({ id: source.id, kind: source.kind }));
    try {
      const listed =
        sources.length === 0
          ? NOTHING_LISTED
          : await listEvents({ sources, from: range.from, to: range.to });
      if (!claimed.isCurrent()) {
        return;
      }
      set((state) => ({
        calendarDay: {
          range,
          events: eventsWithRoles({ events: listed.items, roles: state.calendarRoles }),
          failedSources: listed.failedSources,
        },
        calendarEventsError: null,
      }));
    } catch (error) {
      if (!claimed.isCurrent()) {
        return;
      }
      set({ calendarEventsError: formatError(error) });
      await get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't load your meetings",
        error,
        coalesceKey: 'calendar-day',
      });
    }
  };
};
