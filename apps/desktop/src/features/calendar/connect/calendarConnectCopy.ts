import type { CalendarSourceKind } from '@goodboy/types';

type Read = Readonly<{
  isRead: boolean;
  text: string;
}>;

type SourceCopy = Readonly<{
  name: string;
  hint: string;
  actionHint: string;
  reads: ReadonlyArray<Read>;
}>;

export const CALENDAR_CONNECT_COPY = {
  eventkit: {
    name: 'Calendars on this Mac',
    hint: 'Google, Exchange and iCloud accounts already in Calendar. No new sign in.',
    actionHint: 'macOS asks once for calendar access.',
    reads: [
      { isRead: true, text: 'Title, time, attendees and the call link' },
      { isRead: true, text: 'Read only: Goodboy cannot add, move or delete events' },
      { isRead: true, text: 'Stays on this Mac, no Goodboy server' },
      { isRead: false, text: 'Never sent to an agent' },
    ],
  },
  ics: {
    name: 'Calendar link',
    hint: 'Any secret iCal address. Works on every system.',
    actionHint: 'Anyone with this link can read the calendar, so it is kept in the Keychain.',
    reads: [
      { isRead: true, text: 'Refreshes every 15 minutes' },
      { isRead: true, text: 'Link kept in the Keychain, shown only as its host' },
      { isRead: true, text: 'Read only by nature' },
      { isRead: false, text: 'Never sent to an agent' },
    ],
  },
} as const satisfies Record<CalendarSourceKind, SourceCopy>;
