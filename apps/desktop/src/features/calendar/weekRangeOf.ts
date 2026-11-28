import type { CalendarRange } from '@goodboy/types';
import { dayStartOf } from './dayStartOf';

const DAYS_IN_WEEK = 7;

type Params = {
  readonly now: number;
};

export const weekRangeOf = ({ now }: Params): CalendarRange => {
  const sinceMonday = (new Date(now).getDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;
  return {
    from: dayStartOf({ at: now, dayOffset: -sinceMonday }),
    to: dayStartOf({ at: now, dayOffset: DAYS_IN_WEEK - sinceMonday }),
  };
};
