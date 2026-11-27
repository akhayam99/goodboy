import type { CalendarEvent, CalendarEventsRequest, CalendarList } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';

export const listCalendarEvents = ({
  sources,
  from,
  to,
}: CalendarEventsRequest): Promise<CalendarList<CalendarEvent>> =>
  invokeCommand<CalendarList<CalendarEvent>>('calendar_list_events', { sources, from, to });
