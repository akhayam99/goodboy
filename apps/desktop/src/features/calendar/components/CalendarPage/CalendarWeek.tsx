import { useMemo } from 'react';
import { WeekGrid } from '@goodboy/ui';
import type { CalendarEvent, CalendarRoleEntry } from '@goodboy/types';
import { calendarWeekOf } from '../../calendarWeekOf';
import type { SelectEventParams } from '../../calendarView';

type Props = {
  readonly events: ReadonlyArray<CalendarEvent>;
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
  readonly now: number;
  readonly selectedId: string | null;
  readonly onSelect: (params: SelectEventParams) => void;
};

export const CalendarWeek = ({ events, roles, now, selectedId, onSelect }: Props) => {
  const week = useMemo(() => calendarWeekOf({ events, roles, now }), [events, roles, now]);
  return (
    <WeekGrid
      ariaLabel="Week"
      days={week.days}
      fromMinute={week.fromMinute}
      toMinute={week.toMinute}
      selectedKey={selectedId}
      onSelect={(id) => onSelect({ id })}
    />
  );
};
