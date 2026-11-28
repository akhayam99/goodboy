import { describe, expect, it } from 'vitest';
import {
  brandId,
  type CalendarEvent,
  type CalendarRoleEntry,
  type CalendarSourceId,
} from '@goodboy/types';
import { calendarFactsOf } from './calendarFactsOf';
import { calendarRowsOf } from './calendarRowsOf';
import { calendarWeekOf } from './calendarWeekOf';

const SOURCE = brandId<CalendarSourceId>({ value: 'mac' });
const MINUTE = 60_000;
const NOW = new Date(2026, 10, 26, 10, 18).getTime();

type EventParams = {
  readonly id: string;
  readonly calendarId?: string;
  readonly title?: string;
  readonly start: number;
  readonly minutes: number;
  readonly callLink?: string | null;
  readonly isBusyOnly?: boolean;
};

const eventOf = ({
  id,
  calendarId = 'work',
  title = id,
  start,
  minutes,
  callLink = null,
  isBusyOnly = false,
}: EventParams): CalendarEvent => ({
  id,
  sourceId: SOURCE,
  calendarId,
  uid: id,
  title,
  start,
  end: start + minutes * MINUTE,
  isAllDay: false,
  location: null,
  callLink,
  isCallLinkTrusted: callLink !== null,
  attendees: [],
  status: 'confirmed',
  isBusyOnly,
});

const ROLES: ReadonlyArray<CalendarRoleEntry> = [
  { sourceId: SOURCE, calendarId: 'focus', role: 'focus' },
];

const EVENTS = [
  eventOf({
    id: 'standup',
    start: NOW - 48 * MINUTE,
    minutes: 15,
    callLink: 'https://meet.google.com/a',
  }),
  eventOf({
    id: 'northwind',
    start: NOW + 12 * MINUTE,
    minutes: 30,
    callLink: 'https://meet.google.com/b',
  }),
  eventOf({
    id: 'focus',
    calendarId: 'focus',
    title: 'Focus',
    start: NOW + 102 * MINUTE,
    minutes: 90,
  }),
  eventOf({
    id: 'review',
    start: NOW + 222 * MINUTE,
    minutes: 45,
    callLink: 'https://acme.zoom.us/j/1',
  }),
  eventOf({ id: 'dentist', title: '', start: NOW + 300 * MINUTE, minutes: 45, isBusyOnly: true }),
  eventOf({ id: 'tomorrow', start: NOW + 24 * 60 * MINUTE, minutes: 30 }),
];

describe('calendarRowsOf', () => {
  const rows = calendarRowsOf({ events: EVENTS, roles: ROLES, now: NOW });

  it('lists the events of today only, by start', () => {
    expect(rows.map((row) => row.id)).toEqual([
      'standup',
      'northwind',
      'focus',
      'review',
      'dentist',
    ]);
  });

  it('says Ended, in 12m, or nothing past the next hour, and the length with formatDuration', () => {
    expect(rows.map((row) => [row.length, row.state])).toEqual([
      ['15m', 'Ended'],
      ['30m', 'in 12m'],
      ['1h 30m', null],
      ['45m', null],
      ['45m', null],
    ]);
  });

  it('marks only a call that starts within 30 minutes as soon', () => {
    expect(rows.filter((row) => row.isCallSoon).map((row) => row.id)).toEqual(['northwind']);
  });

  it('titles a busy only event Busy and a focus calendar focus', () => {
    expect(rows.find((row) => row.id === 'dentist')).toMatchObject({ kind: 'busy', title: 'Busy' });
    expect(rows.find((row) => row.id === 'focus')?.kind).toBe('focus');
  });

  it('colours each calendar from the identity palette', () => {
    expect(rows[0]?.color).toMatch(/^var\(--color-identity-\d\)$/);
  });
});

describe('calendarFactsOf', () => {
  it('joins the date, the calls and the focus time', () => {
    const rows = calendarRowsOf({ events: EVENTS, roles: ROLES, now: NOW });
    expect(calendarFactsOf({ rows, now: NOW })).toBe(
      'Thursday 26 November · 3 calls · 1h 30m focus',
    );
  });
});

describe('calendarWeekOf', () => {
  it('draws Monday to Friday with today marked and every timed event as a block', () => {
    const week = calendarWeekOf({ events: EVENTS, roles: ROLES, now: NOW });
    expect(week.days.map((day) => day.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(week.days.find((day) => day.isToday)?.label).toBe('Thu');
    expect(week.days[3]?.blocks.map((block) => block.title)).toEqual([
      'standup',
      'northwind',
      'Focus',
      'review',
      'Busy',
    ]);
    expect(week.days[4]?.blocks.map((block) => block.key)).toEqual(['tomorrow']);
    expect(week.fromMinute).toBe(8 * 60);
  });

  it('adds the weekend when an event falls on it', () => {
    const saturday = eventOf({ id: 'sat', start: NOW + 2 * 24 * 60 * MINUTE, minutes: 60 });
    const week = calendarWeekOf({ events: [saturday], roles: ROLES, now: NOW });
    expect(week.days).toHaveLength(7);
  });
});
