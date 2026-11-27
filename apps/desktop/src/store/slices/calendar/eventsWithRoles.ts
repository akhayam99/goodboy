import type { CalendarEvent, CalendarRoleEntry } from '@goodboy/types';
import { calendarRoleOf } from './calendarRoleOf';

type Params = {
  readonly events: ReadonlyArray<CalendarEvent>;
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
};

export const eventsWithRoles = ({ events, roles }: Params): ReadonlyArray<CalendarEvent> =>
  events.flatMap((event) => {
    const role = calendarRoleOf({ roles, sourceId: event.sourceId, calendarId: event.calendarId });
    if (role === 'hide' || event.status === 'cancelled') {
      return [];
    }
    if (role !== 'busy') {
      return [event];
    }
    return [
      {
        ...event,
        title: '',
        location: null,
        callLink: null,
        isCallLinkTrusted: false,
        attendees: [],
        isBusyOnly: true,
      },
    ];
  });
