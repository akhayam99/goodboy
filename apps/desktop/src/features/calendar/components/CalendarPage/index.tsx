import { useCallback, useMemo, useState } from 'react';
import { Chip, DrawerColumn, PaneShell, SegmentedTabs } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { useNowSessions } from '../../../../shared/hooks/useNowSessions';
import { useStudioDrawer } from '../../../../shared/hooks/useStudioDrawer';
import { StudioDetail } from '../../../../shared/components/StudioShell/StudioDetail';
import { NAMES } from '../../../../shared/utils/names';
import { calendarFactsOf } from '../../calendarFactsOf';
import { calendarRowsOf } from '../../calendarRowsOf';
import type { CalendarView, SelectEventParams } from '../../calendarView';
import { useCalendarLoad } from '../../hooks/useCalendarLoad';
import { CalendarEventDetail } from '../CalendarEventDetail';
import { CalendarBody } from './CalendarBody';
import { CalendarReminders } from './CalendarReminders';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const VIEWS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
] as const;

const EXPERIMENTAL_TIP = 'Calendar is new. Tell us what breaks.';
const PANEL_LABEL = 'Event';
const RESIZE_LABEL = 'Resize the event panel';
const CLOCK_MS = 30_000;

export const CalendarPage = ({ workspaceId }: Props) => {
  const now = useNow(CLOCK_MS);
  const isReady = useCalendarLoad({ workspaceId, now });
  const [view, setView] = useState<CalendarView>('today');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const roles = useAppStore((state) => state.calendarRoles);
  const events = useAppStore((state) => state.calendarDay?.events ?? EMPTY_ARRAY);
  const { needsYou } = useNowSessions({});
  const rows = useMemo(() => calendarRowsOf({ events, roles, now }), [events, roles, now]);
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const selectedEvent = events.find((event) => event.id === selectedId) ?? null;
  const closeDetail = useCallback(() => setSelectedId(null), []);
  const toggle = useCallback(
    ({ id }: SelectEventParams) => setSelectedId((current) => (current === id ? null : id)),
    [],
  );
  const detail =
    selectedEvent === null ? null : (
      <CalendarEventDetail
        event={selectedEvent}
        row={selectedRow}
        roles={roles}
        needsYou={needsYou}
        now={now}
        onClose={closeDetail}
      />
    );
  const isHosted = useStudioDrawer({
    node: detail,
    ariaLabel: PANEL_LABEL,
    resizeLabel: RESIZE_LABEL,
    onClose: closeDetail,
    ...(selectedId !== null && { drawerKey: selectedId }),
  });

  const page = (
    <PaneShell
      page="calendar"
      scroll="body"
      title={NAMES.calendar}
      badge={<Chip tone="neutral" kind="state" label="Experimental" title={EXPERIMENTAL_TIP} />}
      meta={calendarFactsOf({ rows, now })}
      actions={
        <SegmentedTabs size="xs" ariaLabel="View" options={VIEWS} value={view} onChange={setView} />
      }
    >
      <div data-calendar-page="" className="flex min-w-0 flex-col gap-8">
        <CalendarBody
          view={view}
          isReady={isReady}
          rows={rows}
          events={events}
          roles={roles}
          now={now}
          needsYouCount={needsYou.length}
          selectedId={selectedId}
          onSelect={toggle}
        />
        <CalendarReminders workspaceId={workspaceId} now={now} />
      </div>
    </PaneShell>
  );

  if (isHosted) {
    return <StudioDetail>{page}</StudioDetail>;
  }
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <DrawerColumn
        className="h-full"
        main={<StudioDetail>{page}</StudioDetail>}
        drawer={detail}
        ariaLabel={PANEL_LABEL}
        resizeLabel={RESIZE_LABEL}
      />
    </div>
  );
};
