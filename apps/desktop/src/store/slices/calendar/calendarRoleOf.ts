import {
  DEFAULT_CALENDAR_ROLE,
  type CalendarRole,
  type CalendarRoleEntry,
  type CalendarSourceId,
} from '@goodboy/types';

type Params = {
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
  readonly sourceId: CalendarSourceId;
  readonly calendarId: string;
};

export const calendarRoleOf = ({ roles, sourceId, calendarId }: Params): CalendarRole =>
  roles.find((entry) => entry.sourceId === sourceId && entry.calendarId === calendarId)?.role ??
  DEFAULT_CALENDAR_ROLE;
