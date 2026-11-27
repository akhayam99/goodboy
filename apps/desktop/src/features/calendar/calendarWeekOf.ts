import type { WeekGridBlock, WeekGridDay } from '@goodboy/ui';
import type { CalendarEvent, CalendarRoleEntry } from '@goodboy/types';
import { formatClock } from '../../shared/utils/time/formatClock';
import { formatWeekday } from '../../shared/utils/time/formatWeekday';
import { calendarIdentity } from '../session/timeline/calendarIdentity';
import { dayStartOf } from './dayStartOf';
import { eventKindOf } from './eventKindOf';
import { eventTitleOf } from './eventTitleOf';
import { weekRangeOf } from './weekRangeOf';

export type CalendarWeek = {
  readonly days: ReadonlyArray<WeekGridDay>;
  readonly fromMinute: number;
  readonly toMinute: number;
};

type Params = {
  readonly events: ReadonlyArray<CalendarEvent>;
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
  readonly now: number;
};

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const WORK_DAYS = 5;
const WEEK_DAYS = 7;
const FIRST_MINUTE = 8 * HOUR_MINUTES;
const LAST_MINUTE = 18 * HOUR_MINUTES;
const DAY_MINUTES = 24 * HOUR_MINUTES;

type BlockParams = {
  readonly event: CalendarEvent;
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
  readonly dayStart: number;
};

const blockOf = ({ event, roles, dayStart }: BlockParams): WeekGridBlock => {
  const kind = eventKindOf({ event, roles });
  const title = eventTitleOf({ event, kind });
  const start = Math.max(event.start, dayStart);
  return {
    key: event.id,
    title,
    startMinute: Math.max(0, Math.round((start - dayStart) / MINUTE_MS)),
    endMinute: Math.min(DAY_MINUTES, Math.round((event.end - dayStart) / MINUTE_MS)),
    color: calendarIdentity({ sourceId: event.sourceId, calendarId: event.calendarId }),
    isQuiet: kind === 'busy',
    ariaLabel: `${formatClock({ at: start })} ${title}`,
  };
};

export const calendarWeekOf = ({ events, roles, now }: Params): CalendarWeek => {
  const { from } = weekRangeOf({ now });
  const today = dayStartOf({ at: now });
  const timed = events.filter((event) => !event.isAllDay);
  const all = Array.from({ length: WEEK_DAYS }, (_, offset): WeekGridDay => {
    const dayStart = dayStartOf({ at: from, dayOffset: offset });
    const dayEnd = dayStartOf({ at: from, dayOffset: offset + 1 });
    return {
      key: String(dayStart),
      label: formatWeekday({ at: dayStart, isShort: true }),
      isToday: dayStart === today,
      blocks: timed
        .filter((event) => event.start < dayEnd && event.end > dayStart)
        .sort((first, second) => first.start - second.start)
        .map((event) => blockOf({ event, roles, dayStart })),
    };
  });
  const isWeekendUsed = all.slice(WORK_DAYS).some((day) => day.blocks.length > 0 || day.isToday);
  const days = isWeekendUsed ? all : all.slice(0, WORK_DAYS);
  const blocks = days.flatMap((day) => day.blocks);
  return {
    days,
    fromMinute: Math.min(FIRST_MINUTE, ...blocks.map((block) => block.startMinute)),
    toMinute: Math.max(LAST_MINUTE, ...blocks.map((block) => block.endMinute)),
  };
};
