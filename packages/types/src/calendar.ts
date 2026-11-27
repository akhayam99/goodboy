import type { WorkspaceId } from './ids';

export type CalendarSourceId = string & { readonly __brand: 'CalendarSourceId' };
export type ReminderId = string & { readonly __brand: 'ReminderId' };

export const CALENDAR_SOURCE_KINDS = ['eventkit', 'ics'] as const;
export type CalendarSourceKind = (typeof CALENDAR_SOURCE_KINDS)[number];

export const CALENDAR_ROLES = ['show', 'busy', 'focus', 'hide'] as const;
export type CalendarRole = (typeof CALENDAR_ROLES)[number];

export const DEFAULT_CALENDAR_ROLE: CalendarRole = 'show';

export const REMINDER_TRIGGERS = ['time', 'ci_green', 'agent_done', 'call_end'] as const;
export type ReminderTrigger = (typeof REMINDER_TRIGGERS)[number];

export const REMINDER_TARGET_KINDS = ['session', 'pull_request', 'event'] as const;
export type ReminderTargetKind = (typeof REMINDER_TARGET_KINDS)[number];

export const CALENDAR_EVENT_STATUSES = ['confirmed', 'tentative', 'cancelled'] as const;
export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export type CalendarSource = Readonly<{
  id: CalendarSourceId;
  kind: CalendarSourceKind;
  label: string;
  host: string | null;
  createdAt: number;
}>;

export type CalendarRoleEntry = Readonly<{
  sourceId: CalendarSourceId;
  calendarId: string;
  role: CalendarRole;
}>;

export type ReminderTarget = Readonly<{
  kind: ReminderTargetKind;
  id: string;
}>;

export type Reminder = Readonly<{
  id: ReminderId;
  workspaceId: WorkspaceId;
  text: string;
  trigger: ReminderTrigger;
  dueAt: number | null;
  target: ReminderTarget | null;
  snoozedUntil: number | null;
  doneAt: number | null;
  createdAt: number;
}>;

export type CalendarEvent = Readonly<{
  id: string;
  sourceId: CalendarSourceId;
  calendarId: string;
  uid: string;
  title: string;
  start: number;
  end: number;
  isAllDay: boolean;
  location: string | null;
  callLink: string | null;
  attendees: ReadonlyArray<string>;
  status: CalendarEventStatus;
  isBusyOnly: boolean;
}>;

export type CalendarRange = Readonly<{
  from: number;
  to: number;
}>;
