import type { InvokeArgs } from '@tauri-apps/api/core';
import type { CalendarEvent, CalendarSourceId } from '@goodboy/types';
import { mockSceneIpc } from '../../mockSceneIpc';
import { payloadString } from '../../audit/ipcPayload';
import { WORKSPACE_ID } from '../../BoardScene';

export type CalendarSceneVariant = 'day' | 'open' | 'week' | 'empty' | 'busy' | 'quiet';

type ReminderRow = {
  readonly id: string;
  readonly workspace_id: string;
  readonly text: string;
  readonly trigger_kind: string;
  readonly due_at: number | null;
  readonly target_kind: string | null;
  readonly target_id: string | null;
  readonly snoozed_until: number | null;
  readonly done_at: number | null;
  readonly created_at: number;
};

type Params = {
  readonly variant: CalendarSceneVariant;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SOURCE_ID = 'scene-source-mac' as CalendarSourceId;
const WORK = 'scene-calendar-work';
const FOCUS = 'scene-calendar-focus';
const PERSONAL = 'scene-calendar-personal';

type EventParams = {
  readonly id: string;
  readonly calendarId: string;
  readonly title: string;
  readonly start: number;
  readonly minutes: number;
  readonly callLink?: string;
  readonly attendees?: ReadonlyArray<string>;
};

const eventOf = ({
  id,
  calendarId,
  title,
  start,
  minutes,
  callLink,
  attendees = [],
}: EventParams): CalendarEvent => ({
  id,
  sourceId: SOURCE_ID,
  calendarId,
  uid: `${id}@scene`,
  title,
  start,
  end: start + minutes * MINUTE_MS,
  isAllDay: false,
  location: null,
  callLink: callLink ?? null,
  isCallLinkTrusted: callLink !== undefined,
  attendees,
  status: 'confirmed',
  isBusyOnly: false,
});

type NowParams = {
  readonly now: number;
};

const dayEventsOf = ({ now }: NowParams): ReadonlyArray<CalendarEvent> => [
  eventOf({
    id: 'scene-standup',
    calendarId: WORK,
    title: 'ledger-core standup',
    start: now - 48 * MINUTE_MS,
    minutes: 15,
    callLink: 'https://meet.google.com/abc-defg-hij',
    attendees: ['Mara Ilic', 'Teo Brand', 'Ines Kova'],
  }),
  eventOf({
    id: 'scene-northwind',
    calendarId: WORK,
    title: 'Northwind sync: payments-api rollout',
    start: now + 12 * MINUTE_MS,
    minutes: 30,
    callLink: 'https://meet.google.com/xyz-abcd-efg',
    attendees: ['Mara Ilic', 'Dov Arent'],
  }),
  eventOf({
    id: 'scene-focus',
    calendarId: FOCUS,
    title: 'Focus',
    start: now + 102 * MINUTE_MS,
    minutes: 90,
  }),
  eventOf({
    id: 'scene-cascadia',
    calendarId: WORK,
    title: 'Cascadia design review',
    start: now + 222 * MINUTE_MS,
    minutes: 45,
    callLink: 'https://acme.zoom.us/j/123456789',
    attendees: ['Lea Moro', 'Teo Brand'],
  }),
  eventOf({
    id: 'scene-personal',
    calendarId: PERSONAL,
    title: 'Dentist',
    start: now + 372 * MINUTE_MS,
    minutes: 45,
  }),
];

const weekEventsOf = ({ now }: NowParams): ReadonlyArray<CalendarEvent> => [
  ...dayEventsOf({ now }),
  eventOf({
    id: 'scene-harborline',
    calendarId: WORK,
    title: 'Harborline planning',
    start: now - DAY_MS - 60 * MINUTE_MS,
    minutes: 90,
  }),
  eventOf({
    id: 'scene-notify',
    calendarId: WORK,
    title: 'notify-relay review',
    start: now + DAY_MS + 120 * MINUTE_MS,
    minutes: 60,
  }),
  eventOf({
    id: 'scene-focus-next',
    calendarId: FOCUS,
    title: 'Focus',
    start: now + 2 * DAY_MS - 90 * MINUTE_MS,
    minutes: 180,
  }),
];

const sourceRows = [
  { id: SOURCE_ID, kind: 'eventkit', label: 'This Mac', host: null, created_at: 1 },
];

type RolesParams = {
  readonly variant: CalendarSceneVariant;
};

const roleRowsOf = ({ variant }: RolesParams) => [
  { source_id: SOURCE_ID, calendar_id: FOCUS, role: 'focus' },
  { source_id: SOURCE_ID, calendar_id: PERSONAL, role: 'busy' },
  ...(variant === 'busy' ? [{ source_id: SOURCE_ID, calendar_id: WORK, role: 'busy' }] : []),
];

const reminderRowsOf = ({ now }: NowParams): Array<ReminderRow> => [
  {
    id: 'scene-reminder-merge',
    workspace_id: WORKSPACE_ID,
    text: 'Merge payments-api #412',
    trigger_kind: 'time',
    due_at: now + 2 * HOUR_MS,
    target_kind: null,
    target_id: null,
    snoozed_until: null,
    done_at: null,
    created_at: now - DAY_MS,
  },
  {
    id: 'scene-reminder-reply',
    workspace_id: WORKSPACE_ID,
    text: 'Reply to Mara about the rollout',
    trigger_kind: 'time',
    due_at: now + 4 * HOUR_MS,
    target_kind: null,
    target_id: null,
    snoozed_until: null,
    done_at: null,
    created_at: now - DAY_MS,
  },
  {
    id: 'scene-reminder-plan',
    workspace_id: WORKSPACE_ID,
    text: 'Review the notify-relay plan',
    trigger_kind: 'time',
    due_at: now + DAY_MS,
    target_kind: null,
    target_id: null,
    snoozed_until: null,
    done_at: null,
    created_at: now - DAY_MS,
  },
];

type PayloadParams = {
  readonly payload: InvokeArgs | undefined;
};

const paramsOf = ({ payload }: PayloadParams): ReadonlyArray<unknown> => {
  if (payload === undefined || Array.isArray(payload) || payload instanceof ArrayBuffer) {
    return [];
  }
  if (payload instanceof Uint8Array) {
    return [];
  }
  const params = payload['params'];
  return Array.isArray(params) ? params : [];
};

type VariantNowParams = NowParams & {
  readonly variant: CalendarSceneVariant;
};

const eventsOf = ({ variant, now }: VariantNowParams): ReadonlyArray<CalendarEvent> => {
  if (variant === 'quiet' || variant === 'empty') {
    return [];
  }
  return variant === 'week' ? weekEventsOf({ now }) : dayEventsOf({ now });
};

export const installCalendarScene = ({ variant }: Params): void => {
  const now = Date.now();
  const isEmpty = variant === 'empty';
  const events = eventsOf({ variant, now });
  const reminders = isEmpty ? [] : reminderRowsOf({ now });

  mockSceneIpc((command, payload) => {
    const sql = (payloadString({ payload, key: 'sql' }) ?? '').replace(/\s+/g, ' ');
    const params = paramsOf({ payload });
    if (command === 'calendar_list_events') {
      return { items: events, failedSources: [] };
    }
    if (command === 'db_select' && sql.includes('FROM calendar_sources')) {
      return isEmpty ? [] : sourceRows;
    }
    if (command === 'db_select' && sql.includes('FROM calendar_roles')) {
      return isEmpty ? [] : roleRowsOf({ variant });
    }
    if (command === 'db_select' && sql.includes('FROM reminders') && sql.includes('WHERE id = ?')) {
      return reminders.filter((row) => row.id === params[0]);
    }
    if (command === 'db_select' && sql.includes('FROM reminders')) {
      return reminders;
    }
    if (command === 'db_execute' && sql.startsWith('INSERT INTO reminders')) {
      reminders.push({
        id: String(params[0]),
        workspace_id: String(params[1]),
        text: String(params[2]),
        trigger_kind: String(params[3]),
        due_at: typeof params[4] === 'number' ? params[4] : null,
        target_kind: null,
        target_id: null,
        snoozed_until: null,
        done_at: null,
        created_at: now,
      });
      return { rowsAffected: 1 };
    }
    if (command === 'db_execute' && sql.startsWith('UPDATE reminders SET done_at = ?')) {
      const row = reminders.find((entry) => entry.id === params[2] && entry.done_at === null);
      if (row === undefined) {
        return { rowsAffected: 0 };
      }
      reminders.splice(reminders.indexOf(row), 1, { ...row, done_at: Number(params[0]) });
      return { rowsAffected: 1 };
    }
    if (command === 'db_execute' && sql.startsWith('UPDATE reminders SET done_at = NULL')) {
      const row = reminders.find((entry) => entry.id === params[1] && entry.done_at === params[3]);
      if (row === undefined) {
        return { rowsAffected: 0 };
      }
      reminders.splice(reminders.indexOf(row), 1, { ...row, done_at: null });
      return { rowsAffected: 1 };
    }
    return null;
  });
};
