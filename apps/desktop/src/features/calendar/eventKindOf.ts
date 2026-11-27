import type { CalendarEvent, CalendarRoleEntry } from '@goodboy/types';
import { calendarRoleOf } from '../../store/slices/calendar/calendarRoleOf';

export type CalendarEventKind = 'event' | 'busy' | 'focus';

type Params = {
  readonly event: CalendarEvent;
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
};

export const eventKindOf = ({ event, roles }: Params): CalendarEventKind => {
  if (event.isBusyOnly) {
    return 'busy';
  }
  const role = calendarRoleOf({ roles, sourceId: event.sourceId, calendarId: event.calendarId });
  return role === 'focus' ? 'focus' : 'event';
};
