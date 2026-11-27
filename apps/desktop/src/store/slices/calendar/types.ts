import type {
  CalendarEvent,
  CalendarEventsRequest,
  CalendarList,
  CalendarRange,
  CalendarRoleEntry,
  CalendarSource,
  CalendarSourceId,
  ReminderId,
  ReminderTarget,
  ReminderTrigger,
  WorkspaceId,
} from '@goodboy/types';

export type ListCalendarEvents = (
  request: CalendarEventsRequest,
) => Promise<CalendarList<CalendarEvent>>;

export type LoadCalendarEventsParams = {
  readonly range: CalendarRange;
  readonly listEvents: ListCalendarEvents;
};

export type AddCalendarSourceParams = {
  readonly source: CalendarSource;
};

export type RemoveCalendarSourceParams = {
  readonly sourceId: CalendarSourceId;
};

export type SetCalendarRoleParams = {
  readonly entry: CalendarRoleEntry;
};

export type LoadRemindersParams = {
  readonly workspaceId: WorkspaceId;
  readonly doneSince: number;
};

export type AddReminderParams = {
  readonly workspaceId: WorkspaceId;
  readonly text: string;
  readonly trigger: ReminderTrigger;
  readonly dueAt: number | null;
  readonly target: ReminderTarget | null;
};

export type ReminderParams = {
  readonly workspaceId: WorkspaceId;
  readonly reminderId: ReminderId;
};

export type SnoozeReminderParams = ReminderParams & {
  readonly snoozedUntil: number;
};

export type FireReminderParams = ReminderParams & {
  readonly firedAt: number;
};
