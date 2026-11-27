import type { CalendarEvent, CalendarRoleEntry } from '@goodboy/types';
import { formatClock } from '../../shared/utils/time/formatClock';
import { formatDuration } from '../../shared/utils/time/formatDuration';
import { calendarIdentity } from '../session/timeline/calendarIdentity';
import { dayStartOf } from './dayStartOf';
import { eventKindOf, type CalendarEventKind } from './eventKindOf';
import { eventTitleOf } from './eventTitleOf';

export type CalendarRow = {
  readonly id: string;
  readonly event: CalendarEvent;
  readonly kind: CalendarEventKind;
  readonly start: string;
  readonly title: string;
  readonly length: string | null;
  readonly state: string | null;
  readonly isEnded: boolean;
  readonly isCallSoon: boolean;
  readonly color: string;
};

type Params = {
  readonly events: ReadonlyArray<CalendarEvent>;
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
  readonly now: number;
};

const MINUTE_MS = 60_000;
const STATE_WINDOW_MS = 60 * MINUTE_MS;
const CALL_SOON_MS = 30 * MINUTE_MS;
const ALL_DAY = 'All day';

type WaitParams = {
  readonly waitMs: number;
};

const startsInOf = ({ waitMs }: WaitParams): string | null => {
  const rounded = waitMs >= MINUTE_MS ? Math.floor(waitMs / MINUTE_MS) * MINUTE_MS : waitMs;
  const span = formatDuration({ durationMs: rounded });
  return span === null ? 'Now' : `in ${span}`;
};

type StateParams = {
  readonly event: CalendarEvent;
  readonly now: number;
};

const stateOf = ({ event, now }: StateParams): string | null => {
  if (event.end <= now) {
    return 'Ended';
  }
  if (event.start <= now) {
    return 'Now';
  }
  const waitMs = event.start - now;
  return waitMs <= STATE_WINDOW_MS ? startsInOf({ waitMs }) : null;
};

const isCallSoonOf = ({ event, now }: StateParams): boolean =>
  event.callLink !== null && event.end > now && event.start - now <= CALL_SOON_MS;

export const calendarRowsOf = ({ events, roles, now }: Params): ReadonlyArray<CalendarRow> => {
  const from = dayStartOf({ at: now });
  const to = dayStartOf({ at: now, dayOffset: 1 });
  return events
    .filter((event) => event.start < to && event.end > from)
    .sort((first, second) => first.start - second.start || first.id.localeCompare(second.id))
    .map((event) => {
      const kind = eventKindOf({ event, roles });
      return {
        id: event.id,
        event,
        kind,
        start: event.isAllDay ? ALL_DAY : formatClock({ at: event.start }),
        title: eventTitleOf({ event, kind }),
        length: event.isAllDay ? null : formatDuration({ durationMs: event.end - event.start }),
        state: event.isAllDay ? null : stateOf({ event, now }),
        isEnded: event.end <= now,
        isCallSoon: kind === 'event' && isCallSoonOf({ event, now }),
        color: calendarIdentity({ sourceId: event.sourceId, calendarId: event.calendarId }),
      };
    });
};
