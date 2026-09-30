import { formatAge } from './formatAge';
import { formatDate } from './formatDate';
import { formatDayMonth } from './formatDayMonth';

const MS_PER_DAY = 86_400_000;

type CalendarDayParams = {
  readonly date: Date;
};

const startOfCalendarDay = ({ date }: CalendarDayParams): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

type Params = {
  readonly at: string | number;
  readonly now: number;
};

export const formatAdaptiveAge = ({ at, now }: Params): string => {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const today = new Date(now);
  const dayGap = Math.round(
    (startOfCalendarDay({ date: today }) - startOfCalendarDay({ date })) / MS_PER_DAY,
  );
  if (dayGap <= 0) {
    return formatAge({ from: at, now });
  }
  if (dayGap === 1) {
    return 'yesterday';
  }
  return date.getFullYear() === today.getFullYear() ? formatDayMonth({ at }) : formatDate({ at });
};
