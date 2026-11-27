import type { CalendarEvent, CalendarRoleEntry } from '@goodboy/types';
import { eventsWithRoles } from '../../../store/slices/calendar/eventsWithRoles';
import type { ChipCall } from './callChipTypes';

type Params = {
  readonly events: ReadonlyArray<CalendarEvent>;
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
  readonly now: number;
};

export const callsOf = ({ events, roles, now }: Params): ReadonlyArray<ChipCall> =>
  eventsWithRoles({ events, roles }).flatMap((event) => {
    const { callLink } = event;
    if (callLink === null || event.isAllDay || event.isBusyOnly || event.end <= now) {
      return [];
    }
    if (event.status === 'cancelled') {
      return [];
    }
    return [
      {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        link: callLink,
        isLinkTrusted: event.isCallLinkTrusted,
        people: event.attendees,
      },
    ];
  });
