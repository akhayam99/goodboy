import type { CalendarEvent, CalendarRoleEntry } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { CalendarRow } from '../../calendarRowsOf';
import type { CalendarView, SelectEventParams } from '../../calendarView';
import { CalendarEmpty } from './CalendarEmpty';
import { CalendarProblem } from './CalendarProblem';
import { CalendarToday } from './CalendarToday';
import { CalendarWeek } from './CalendarWeek';
import { FailedSourcesNotice } from './FailedSourcesNotice';

type Props = {
  readonly view: CalendarView;
  readonly isReady: boolean;
  readonly onRetry: () => Promise<void>;
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
  onRetry,
  rows,
  events,
  roles,
  now,
  needsYouCount,
  selectedId,
  onSelect,
}: Props) => {
  const sourceCount = useAppStore((state) => state.calendarSources.length);
  const sourcesError = useAppStore((state) => state.calendarSourcesError);
  const eventsError = useAppStore((state) => state.calendarEventsError);
  if (!isReady) {
    return null;
  }
  if (sourcesError !== null && sourceCount === 0) {
    return (
      <CalendarProblem
        title="Goodboy can't read your calendar connections"
        body={sourcesError}
        onRetry={onRetry}
      />
    );
  }
  if (sourceCount === 0) {
    return <CalendarEmpty />;
  }
  return (
    <section
      aria-label={view === 'today' ? 'Today' : 'Week'}
      className="flex min-w-0 flex-col gap-3"
    >
      <FailedSourcesNotice onRetry={onRetry} />
      {eventsError !== null ? (
        <CalendarProblem
          title="Goodboy can't read your meetings"
          body={eventsError}
          onRetry={onRetry}
        />
      ) : null}
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
