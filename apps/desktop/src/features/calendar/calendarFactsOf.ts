import { countNoun } from '../../shared/utils/countNoun';
import { joinFacts } from '../../shared/utils/joinFacts';
import { formatDuration } from '../../shared/utils/time/formatDuration';
import { formatIntl } from '../../shared/utils/time/formatIntl';
import { formatWeekday } from '../../shared/utils/time/formatWeekday';
import type { CalendarRow } from './calendarRowsOf';

type Params = {
  readonly rows: ReadonlyArray<CalendarRow>;
  readonly now: number;
};

type DateParams = {
  readonly now: number;
};

const dateOf = ({ now }: DateParams): string =>
  `${formatWeekday({ at: now })} ${new Date(now).getDate()} ${formatIntl({ at: now, options: { month: 'long' } })}`;

export const calendarFactsOf = ({ rows, now }: Params): string => {
  const calls = rows.filter((row) => row.kind === 'event' && row.event.callLink !== null).length;
  const focusMs = rows
    .filter((row) => row.kind === 'focus' && !row.event.isAllDay)
    .reduce((total, row) => total + (row.event.end - row.event.start), 0);
  const focus = formatDuration({ durationMs: focusMs });
  return joinFacts({
    facts: [
      dateOf({ now }),
      calls > 0 ? countNoun({ count: calls, one: 'call' }) : null,
      focus === null ? null : `${focus} focus`,
    ],
  });
};
