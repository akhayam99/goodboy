import { CalendarScene } from './CalendarScene';

export const CALENDAR_PLACE_SCENES = {
  'calendar-day': () => <CalendarScene variant="day" />,
  'calendar-open': () => <CalendarScene variant="open" />,
  'calendar-week': () => <CalendarScene variant="week" />,
  'calendar-empty': () => <CalendarScene variant="empty" />,
  'calendar-busy': () => <CalendarScene variant="busy" />,
  'calendar-quiet': () => <CalendarScene variant="quiet" />,
};
