import { describe, expect, it } from 'vitest';
import {
  brandId,
  type CalendarEvent,
  type CalendarRoleEntry,
  type CalendarSourceId,
} from '@goodboy/types';
import { callsOf } from './callsOf';

const SOURCE = brandId<CalendarSourceId>({ value: 'mac' });
const MINUTE = 60_000;
const NOW = Date.UTC(2026, 10, 27, 10, 0);
const MEET = 'https://meet.google.com/abc-defg-hij';

type EventParams = {
  readonly id: string;
  readonly calendarId?: string;
  readonly callLink?: string | null;
  readonly isAllDay?: boolean;
  readonly status?: CalendarEvent['status'];
  readonly startIn?: number;
};

const eventOf = ({
  id,
  calendarId = 'work',
  callLink = MEET,
  isAllDay = false,
  status = 'confirmed',
  startIn = 10 * MINUTE,
}: EventParams): CalendarEvent => ({
  id,
  sourceId: SOURCE,
  calendarId,
  uid: id,
  title: `Northwind ${id}`,
  start: NOW + startIn,
  end: NOW + startIn + 30 * MINUTE,
  isAllDay,
  location: null,
  callLink,
  isCallLinkTrusted: true,
  attendees: ['Mara Acme'],
  status,
  isBusyOnly: false,
});

type RoleParams = Pick<CalendarRoleEntry, 'calendarId' | 'role'>;

const roleOf = ({ calendarId, role }: RoleParams): CalendarRoleEntry => ({
  sourceId: SOURCE,
  calendarId,
  role,
});

type IdsParams = {
  readonly calls: ReturnType<typeof callsOf>;
};

const idsOf = ({ calls }: IdsParams) => calls.map((call) => call.id);

describe('callsOf', () => {
  it('keeps a meeting with a call link and carries what the chip shows', () => {
    const calls = callsOf({ events: [eventOf({ id: 'sync' })], roles: [], now: NOW });
    expect(calls).toEqual([
      {
        id: 'sync',
        title: 'Northwind sync',
        start: NOW + 10 * MINUTE,
        end: NOW + 40 * MINUTE,
        link: MEET,
        isLinkTrusted: true,
        people: ['Mara Acme'],
      },
    ]);
  });

  it('never alerts for a meeting without a link, all day, cancelled or already over', () => {
    const events = [
      eventOf({ id: 'no-link', callLink: null }),
      eventOf({ id: 'all-day', isAllDay: true }),
      eventOf({ id: 'cancelled', status: 'cancelled' }),
      eventOf({ id: 'over', startIn: -40 * MINUTE }),
      eventOf({ id: 'live', startIn: -10 * MINUTE }),
    ];
    expect(idsOf({ calls: callsOf({ events, roles: [], now: NOW }) })).toEqual(['live']);
  });

  it('never alerts for a hidden or busy only calendar', () => {
    const events = [
      eventOf({ id: 'hidden', calendarId: 'personal' }),
      eventOf({ id: 'busy', calendarId: 'family' }),
      eventOf({ id: 'focus', calendarId: 'focus' }),
      eventOf({ id: 'work' }),
    ];
    const roles = [
      roleOf({ calendarId: 'personal', role: 'hide' }),
      roleOf({ calendarId: 'family', role: 'busy' }),
      roleOf({ calendarId: 'focus', role: 'focus' }),
    ];
    expect(idsOf({ calls: callsOf({ events, roles, now: NOW }) })).toEqual(['focus', 'work']);
  });
});
