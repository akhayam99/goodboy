import type {
  CalendarEvent,
  CalendarRange,
  CalendarRoleEntry,
  CalendarSource,
  CalendarSourceFailure,
  Reminder,
  WorkspaceId,
} from '@goodboy/types';

export type CalendarDay = Readonly<{
  range: CalendarRange;
  events: ReadonlyArray<CalendarEvent>;
  failedSources: ReadonlyArray<CalendarSourceFailure>;
}>;

export type CalendarState = {
  readonly calendarSources: ReadonlyArray<CalendarSource>;
  readonly calendarRoles: ReadonlyArray<CalendarRoleEntry>;
  readonly calendarDay: CalendarDay | null;
  readonly calendarReminders: Readonly<Record<WorkspaceId, ReadonlyArray<Reminder>>>;
};

export const calendarInitialState: CalendarState = {
  calendarSources: [],
  calendarRoles: [],
  calendarDay: null,
  calendarReminders: {},
};
