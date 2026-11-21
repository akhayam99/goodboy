import { formatDate } from './formatDate';
import { formatDayMonth } from './formatDayMonth';
import { formatWeekday } from './formatWeekday';

const MS_PER_DAY = 86_400_000;
const WEEKDAY_SPAN_DAYS = 6;

type CalendarDayParams = {
  readonly date: Date;
};

const startOfCalendarDay = ({ date }: CalendarDayParams): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

type Params = {
  readonly at: string | number;
  readonly now: number;
  readonly casing?: 'label' | 'inline';
};

export const dayLabelOf = ({ at, now, casing = 'label' }: Params): string => {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const today = new Date(now);
  const dayGap = Math.round(
    (startOfCalendarDay({ date: today }) - startOfCalendarDay({ date })) / MS_PER_DAY,
  );
  if (dayGap <= 0) {
    return casing === 'label' ? 'Today' : 'today';
  }
  if (dayGap === 1) {
    return casing === 'label' ? 'Yesterday' : 'yesterday';
  }
  if (dayGap <= WEEKDAY_SPAN_DAYS) {
    return formatWeekday({ at });
  }
  return date.getFullYear() === today.getFullYear() ? formatDayMonth({ at }) : formatDate({ at });
};
