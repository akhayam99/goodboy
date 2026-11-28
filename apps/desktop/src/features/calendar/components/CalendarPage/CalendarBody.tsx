import type { CalendarEvent, CalendarRoleEntry } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { CalendarRow } from '../../calendarRowsOf';
import type { CalendarView, SelectEventParams } from '../../calendarView';
import { CalendarEmpty } from './CalendarEmpty';
import { CalendarToday } from './CalendarToday';
import { CalendarWeek } from './CalendarWeek';
import { FailedSourcesNotice } from './FailedSourcesNotice';

type Props = {
  readonly view: CalendarView;
  readonly isReady: boolean;
  readonly rows: ReadonlyArray<CalendarRow>;
  readonly events: ReadonlyArray<CalendarEvent>;
  readonly roles: ReadonlyArray<CalendarRoleEntry>;
  readonly now: number;
  readonly needsYouCount: number;
  readonly selectedId: string | null;
  readonly onSelect: (params: SelectEventParams) => void;
};

export const CalendarBody = ({
  view,
  isReady,
  rows,
  events,
  roles,
  now,
  needsYouCount,
  selectedId,
  onSelect,
}: Props) => {
  const sourceCount = useAppStore((state) => state.calendarSources.length);
  if (!isReady) {
    return null;
  }
  if (sourceCount === 0) {
    return <CalendarEmpty />;
  }
  return (
    <section
      aria-label={view === 'today' ? 'Today' : 'Week'}
      className="flex min-w-0 flex-col gap-3"
    >
      <FailedSourcesNotice />
      {view === 'today' ? (
        <CalendarToday
          rows={rows}
          needsYouCount={needsYouCount}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : (
        <CalendarWeek
          events={events}
          roles={roles}
          now={now}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
    </section>
  );
};
