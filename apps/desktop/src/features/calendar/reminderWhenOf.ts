import type { Reminder } from '@goodboy/types';
import { formatClock } from '../../shared/utils/time/formatClock';
import { formatDayMonth } from '../../shared/utils/time/formatDayMonth';
import { formatWeekday } from '../../shared/utils/time/formatWeekday';
import { dayStartOf } from './dayStartOf';

type Params = {
  readonly reminder: Reminder;
  readonly now: number;
};

type DayParams = {
  readonly at: number;
  readonly now: number;
};

const dayWordOf = ({ at, now }: DayParams): string => {
  const day = dayStartOf({ at });
  if (day === dayStartOf({ at: now })) {
    return 'Today';
  }
  if (day === dayStartOf({ at: now, dayOffset: 1 })) {
    return 'Tomorrow';
  }
  return `${formatWeekday({ at, isShort: true })} ${formatDayMonth({ at })}`;
};

export const reminderWhenOf = ({ reminder, now }: Params): string => {
  switch (reminder.trigger) {
    case 'ci_green':
      return 'When CI is green';
    case 'agent_done':
      return 'When the agent is done';
    case 'call_end':
      return 'When the call ends';
    case 'time': {
      const at = reminder.snoozedUntil ?? reminder.dueAt;
      return at === null ? '' : `${dayWordOf({ at, now })} ${formatClock({ at })}`;
    }
    default: {
      const unreachable: never = reminder.trigger;
      return unreachable;
    }
  }
};
